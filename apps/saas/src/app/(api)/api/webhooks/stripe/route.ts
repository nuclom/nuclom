/**
 * Unified Stripe Webhook Handler
 *
 * This is the single webhook endpoint for all Stripe events.
 * Uses Workflow DevKit for durable execution - ensures all operations
 * complete even if there are transient failures or server restarts.
 *
 * Benefits:
 * - Automatic retries on database/email failures
 * - Guaranteed delivery of notifications
 * - Built-in observability
 * - Resume from last successful step on restart
 *
 * Configure ONLY this endpoint in Stripe Dashboard with all required events.
 *
 * IDEMPOTENCY: Each event is tracked in processed_webhook_events table
 * to prevent duplicate processing on webhook retries.
 */

import { normalizeOne } from '@nuclom/lib/db/relations';
import {
  type InvoiceStatus,
  type NewInvoice,
  type NewPaymentMethod,
  processedWebhookEvents,
} from '@nuclom/lib/db/schema';
import { AppLive } from '@nuclom/lib/effect';
import { BillingRepository } from '@nuclom/lib/effect/services/billing-repository';
import { Database, type DrizzleDB } from '@nuclom/lib/effect/services/database';
import { EmailNotifications } from '@nuclom/lib/effect/services/email-notifications';
import { NotificationRepository } from '@nuclom/lib/effect/services/notification-repository';
import { SlackMonitoring } from '@nuclom/lib/effect/services/slack-monitoring';
import { StripeServiceTag } from '@nuclom/lib/effect/services/stripe';
import { getAppUrl } from '@nuclom/lib/env/server';
import { logger } from '@nuclom/lib/logger';
import { eq } from 'drizzle-orm';
import { Cause, Effect, Exit, Option } from 'effect';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { start } from 'workflow/api';
import {
  handleInvoiceFailedWorkflow,
  handleInvoicePaidWorkflow,
  handleSubscriptionCreatedWorkflow,
  handleSubscriptionDeletedWorkflow,
  handleSubscriptionUpdatedWorkflow,
  handleTrialEndingWorkflow,
} from '@/workflows/stripe-webhooks';

// Events that Better Auth needs to handle for subscription management
const BETTER_AUTH_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.pending_update_applied',
  'customer.subscription.pending_update_expired',
  'checkout.session.completed',
]);

// =============================================================================
// Forward events to Better Auth webhook handler
// =============================================================================

async function forwardToBetterAuth(body: string, signature: string): Promise<void> {
  const betterAuthWebhookUrl = `${getAppUrl()}/api/auth/stripe/webhook`;

  try {
    const response = await fetch(betterAuthWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      logger.error('Better Auth forwarding failed', undefined, {
        status: response.status,
        response: text,
        component: 'stripe-webhook',
      });
    } else {
      logger.info('Event forwarded to Better Auth successfully', { component: 'stripe-webhook' });
    }
  } catch (error) {
    logger.error('Failed to forward event to Better Auth', error instanceof Error ? error : new Error(String(error)), {
      component: 'stripe-webhook',
    });
  }
}

// =============================================================================
// POST /api/webhooks/stripe - Unified Stripe webhook handler
// =============================================================================

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    // Get Stripe service and verify webhook signature
    const stripe = yield* StripeServiceTag;
    const event = yield* stripe.constructWebhookEvent(body, signature);
    const billingRepo = yield* BillingRepository;
    const { db } = yield* Database;

    // =============================================================================
    // IDEMPOTENCY CHECK - Prevent duplicate processing
    // =============================================================================
    const existingEvent = yield* Effect.tryPromise({
      try: () =>
        db.query.processedWebhookEvents.findFirst({
          where: eq(processedWebhookEvents.eventId, event.id),
        }),
      catch: (error) => new Error(`Failed to check event idempotency: ${error}`),
    });

    if (existingEvent) {
      logger.info('Event already processed, skipping', {
        eventId: event.id,
        processedAt: existingEvent.processedAt.toISOString(),
        component: 'stripe-webhook',
      });
      return { received: true, duplicate: true };
    }

    // Mark event as being processed (do this early to prevent race conditions)
    yield* Effect.tryPromise({
      try: () =>
        db.insert(processedWebhookEvents).values({
          eventId: event.id,
          eventType: event.type,
          source: 'stripe',
        }),
      catch: (error) => {
        // If insert fails due to unique constraint, another process is handling it
        logger.info('Event is being processed by another handler', { eventId: event.id, component: 'stripe-webhook' });
        return error;
      },
    });

    // Forward subscription/checkout events to Better Auth
    if (BETTER_AUTH_EVENTS.has(event.type)) {
      yield* Effect.tryPromise({
        try: () => forwardToBetterAuth(body, signature),
        catch: (error) => new Error(`Failed to forward to Better Auth: ${error}`),
      });
    }

    // Handle the event using durable workflows
    // Workflows run asynchronously and will retry on failure
    switch (event.type) {
      // Subscription lifecycle events - use durable workflows
      case 'customer.subscription.created': {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.referenceId;
        if (organizationId) {
          yield* Effect.tryPromise({
            try: () =>
              start(handleSubscriptionCreatedWorkflow, [
                { eventId: event.id, eventType: event.type, data: { subscription, organizationId } },
              ]),
            catch: (error) => new Error(`Failed to start subscription created workflow: ${error}`),
          });
        }
        logger.info('Subscription created - workflow started', {
          subscriptionId: subscription.id,
          component: 'stripe-webhook',
        });
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        yield* Effect.tryPromise({
          try: () =>
            start(handleSubscriptionUpdatedWorkflow, [
              { eventId: event.id, eventType: event.type, data: subscription },
            ]),
          catch: (error) => new Error(`Failed to start subscription updated workflow: ${error}`),
        });
        logger.info('Subscription updated - workflow started', {
          subscriptionId: subscription.id,
          component: 'stripe-webhook',
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        yield* Effect.tryPromise({
          try: () =>
            start(handleSubscriptionDeletedWorkflow, [
              { eventId: event.id, eventType: event.type, data: subscription },
            ]),
          catch: (error) => new Error(`Failed to start subscription deleted workflow: ${error}`),
        });
        logger.info('Subscription deleted - workflow started', {
          subscriptionId: subscription.id,
          component: 'stripe-webhook',
        });
        break;
      }

      // Invoice events - use durable workflows for reliability
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        // Still track in local DB synchronously for immediate consistency
        yield* handleInvoicePaidEffect(invoice, billingRepo, db);
        // Then start durable workflow for notifications
        yield* Effect.tryPromise({
          try: () => start(handleInvoicePaidWorkflow, [{ eventId: event.id, eventType: event.type, data: invoice }]),
          catch: (error) => new Error(`Failed to start invoice paid workflow: ${error}`),
        });
        logger.info('Invoice paid - workflow started', { invoiceId: invoice.id, component: 'stripe-webhook' });
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Start durable workflow for notifications and follow-up
        const subscriptionId = invoice.parent?.subscription_details?.subscription;
        const stripeSubId = typeof subscriptionId === 'string' ? subscriptionId : subscriptionId?.id;
        yield* Effect.tryPromise({
          try: () =>
            start(handleInvoiceFailedWorkflow, [
              { eventId: event.id, eventType: event.type, data: { ...invoice, stripeSubscriptionId: stripeSubId } },
            ]),
          catch: (error) => new Error(`Failed to start invoice failed workflow: ${error}`),
        });
        logger.info('Invoice payment failed - workflow started', {
          invoiceId: invoice.id,
          component: 'stripe-webhook',
        });
        break;
      }

      case 'invoice.created': {
        const invoice = event.data.object as Stripe.Invoice;
        yield* handleInvoiceCreated(invoice, billingRepo);
        logger.info('Invoice created', { invoiceId: invoice.id, component: 'stripe-webhook' });
        break;
      }

      case 'invoice.updated': {
        const invoice = event.data.object as Stripe.Invoice;
        yield* handleInvoiceUpdated(invoice, billingRepo);
        logger.info('Invoice updated', { invoiceId: invoice.id, component: 'stripe-webhook' });
        break;
      }

      // Payment method events - keep synchronous (fast operations)
      case 'payment_method.attached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        yield* handlePaymentMethodAttached(paymentMethod, billingRepo);
        logger.info('Payment method attached', { paymentMethodId: paymentMethod.id, component: 'stripe-webhook' });
        break;
      }

      case 'payment_method.detached': {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        yield* billingRepo.deletePaymentMethod(paymentMethod.id);
        logger.info('Payment method detached', { paymentMethodId: paymentMethod.id, component: 'stripe-webhook' });
        break;
      }

      // Trial ending notification - use durable workflow
      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        yield* Effect.tryPromise({
          try: () =>
            start(handleTrialEndingWorkflow, [{ eventId: event.id, eventType: event.type, data: subscription }]),
          catch: (error) => new Error(`Failed to start trial ending workflow: ${error}`),
        });
        logger.info('Trial ending - workflow started', {
          subscriptionId: subscription.id,
          component: 'stripe-webhook',
        });
        break;
      }

      default:
        logger.info('Webhook event processed', { eventType: event.type, component: 'stripe-webhook' });
    }

    return { received: true };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (Option.isSome(error)) {
        const err = error.value;
        if (err && typeof err === 'object' && '_tag' in err) {
          // Cast to unknown first to allow checking any _tag value
          const errorTag = (err as { _tag: string })._tag;
          if (errorTag === 'WebhookSignatureError') {
            return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
          }
        }
        logger.error('Webhook error', err instanceof Error ? err : new Error(String(err)), {
          component: 'stripe-webhook',
        });
      }
      return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data),
  });
}

// =============================================================================
// Types
// =============================================================================

type BillingRepoType = typeof BillingRepository.Service;
type DbType = DrizzleDB;

// =============================================================================
// Helper Functions
// =============================================================================

const mapStripeInvoiceStatus = (status: string | null): InvoiceStatus => {
  if (!status) return 'draft';
  const statusMap: Record<string, InvoiceStatus> = {
    draft: 'draft',
    open: 'open',
    paid: 'paid',
    void: 'void',
    uncollectible: 'uncollectible',
  };
  return statusMap[status] ?? 'open';
};

// Get metadata reference ID from invoice
const getInvoiceReferenceId = (invoice: Stripe.Invoice): string | undefined => {
  // Try parent.subscription_details metadata first (Stripe API v2024+)
  if (invoice.parent?.subscription_details?.metadata?.referenceId) {
    return invoice.parent.subscription_details.metadata.referenceId;
  }
  // Fall back to checking the subscription metadata directly
  const subscription = invoice.parent?.subscription_details?.subscription;
  if (typeof subscription === 'object' && subscription?.metadata?.referenceId) {
    return subscription.metadata.referenceId;
  }
  return undefined;
};

// =============================================================================
// Invoice Handlers
// =============================================================================

const handleInvoicePaidEffect = (stripeInvoice: Stripe.Invoice, billingRepo: BillingRepoType, db: DbType) =>
  Effect.gen(function* () {
    const subscriptionDetails = stripeInvoice.parent?.subscription_details;
    if (!subscriptionDetails?.subscription) return;

    const organizationId = getInvoiceReferenceId(stripeInvoice);
    if (!organizationId) {
      logger.warn('No organizationId in invoice metadata', {
        invoiceId: stripeInvoice.id,
        component: 'stripe-webhook',
      });
      return;
    }

    const paymentIntent = (stripeInvoice as { payment_intent?: string | { id: string } | null }).payment_intent;
    const paymentIntentId = typeof paymentIntent === 'string' ? paymentIntent : paymentIntent?.id;

    const invoiceData: NewInvoice = {
      organizationId,
      stripeInvoiceId: stripeInvoice.id,
      stripePaymentIntentId: paymentIntentId,
      amount: stripeInvoice.amount_due,
      amountPaid: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency,
      status: mapStripeInvoiceStatus(stripeInvoice.status),
      pdfUrl: stripeInvoice.invoice_pdf ?? undefined,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
      periodStart: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : undefined,
      periodEnd: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : undefined,
      paidAt: new Date(),
    };

    // Try to update existing or create new
    const existingInvoice = yield* billingRepo.getInvoiceByStripeId(stripeInvoice.id).pipe(Effect.option);

    if (Option.isSome(existingInvoice)) {
      yield* billingRepo.updateInvoice(stripeInvoice.id, invoiceData);
    } else {
      yield* billingRepo.createInvoice(invoiceData);
    }

    // Send payment succeeded notification
    yield* sendPaymentNotification(organizationId, 'payment_succeeded', db);

    // Send Slack monitoring notification
    const slackMonitoring = yield* SlackMonitoring;
    yield* slackMonitoring
      .sendBillingEvent('payment_succeeded', {
        organizationId,
        organizationName: organizationId, // We'll get the actual name in the notification
        amount: stripeInvoice.amount_paid,
        currency: stripeInvoice.currency,
      })
      .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

const handleInvoiceCreated = (stripeInvoice: Stripe.Invoice, billingRepo: BillingRepoType) =>
  Effect.gen(function* () {
    const organizationId = getInvoiceReferenceId(stripeInvoice);
    if (!organizationId) return;

    const invoiceData: NewInvoice = {
      organizationId,
      stripeInvoiceId: stripeInvoice.id,
      amount: stripeInvoice.amount_due,
      amountPaid: stripeInvoice.amount_paid,
      currency: stripeInvoice.currency,
      status: mapStripeInvoiceStatus(stripeInvoice.status),
      pdfUrl: stripeInvoice.invoice_pdf ?? undefined,
      hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
      periodStart: stripeInvoice.period_start ? new Date(stripeInvoice.period_start * 1000) : undefined,
      periodEnd: stripeInvoice.period_end ? new Date(stripeInvoice.period_end * 1000) : undefined,
    };

    yield* billingRepo.createInvoice(invoiceData);
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

const handleInvoiceUpdated = (stripeInvoice: Stripe.Invoice, billingRepo: BillingRepoType) =>
  Effect.gen(function* () {
    yield* billingRepo
      .updateInvoice(stripeInvoice.id, {
        amount: stripeInvoice.amount_due,
        amountPaid: stripeInvoice.amount_paid,
        status: mapStripeInvoiceStatus(stripeInvoice.status),
        pdfUrl: stripeInvoice.invoice_pdf ?? undefined,
        hostedInvoiceUrl: stripeInvoice.hosted_invoice_url ?? undefined,
        paidAt: stripeInvoice.status === 'paid' ? new Date() : undefined,
      })
      .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
  });

// =============================================================================
// Payment Method Handlers
// =============================================================================

const handlePaymentMethodAttached = (paymentMethod: Stripe.PaymentMethod, billingRepo: BillingRepoType) =>
  Effect.gen(function* () {
    const organizationId = paymentMethod.metadata?.organizationId;
    if (!organizationId) return;

    const paymentMethodData: NewPaymentMethod = {
      organizationId,
      stripePaymentMethodId: paymentMethod.id,
      type: paymentMethod.type,
      brand: paymentMethod.card?.brand,
      last4: paymentMethod.card?.last4,
      expMonth: paymentMethod.card?.exp_month,
      expYear: paymentMethod.card?.exp_year,
      isDefault: false,
    };

    yield* billingRepo.createPaymentMethod(paymentMethodData);
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

// =============================================================================
// Notification Helpers
// =============================================================================

const sendPaymentNotification = (
  organizationId: string,
  eventType: 'payment_succeeded' | 'payment_failed',
  db: DbType,
) =>
  Effect.gen(function* () {
    const notificationRepo = yield* NotificationRepository;
    const emailService = yield* EmailNotifications;

    // Get organization
    const org = yield* Effect.tryPromise({
      try: () =>
        db.query.organizations.findFirst({
          where: (o, { eq }) => eq(o.id, organizationId),
        }),
      catch: () => new Error('Failed to get organization'),
    });

    if (!org) return;

    // Get organization owners
    const ownerMembers = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findMany({
          where: (m, { and, eq: colEq }) => and(colEq(m.organizationId, organizationId), colEq(m.role, 'owner')),
          with: { user: true },
        }),
      catch: () => new Error('Failed to get organization members'),
    });

    const notificationTitles = {
      payment_succeeded: 'Payment successful',
      payment_failed: 'Payment failed',
    };

    const notificationBodies = {
      payment_succeeded: `Your payment for ${org.name} was processed successfully.`,
      payment_failed: `We couldn't process your payment for ${org.name}. Please update your payment method.`,
    };

    for (const member of ownerMembers) {
      const user = normalizeOne(member.user);
      if (!user?.email) continue;

      // Create in-app notification
      yield* notificationRepo.createNotification({
        userId: user.id,
        type: eventType,
        title: notificationTitles[eventType],
        body: notificationBodies[eventType],
        resourceType: 'subscription',
        resourceId: organizationId,
      });

      // Send email notification
      yield* emailService
        .sendSubscriptionNotification({
          recipientEmail: user.email,
          recipientName: user.name || 'there',
          organizationName: org.name,
          eventType,
          billingUrl: `${getAppUrl()}/${org.slug}/settings/billing`,
        })
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
    }
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));
