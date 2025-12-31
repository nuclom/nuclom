/**
 * Custom Stripe Webhook Handler
 *
 * NOTE: Better Auth Stripe handles subscription lifecycle webhooks at /api/auth/stripe/webhook.
 * This endpoint handles additional events not covered by Better Auth Stripe, such as:
 * - Invoice tracking in our local database
 * - Payment method management
 * - Custom notifications and usage tracking
 *
 * Configure this endpoint in Stripe Dashboard alongside the Better Auth webhook.
 */

import { Cause, Effect, Exit, Option } from "effect";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import type { InvoiceStatus, NewInvoice, NewPaymentMethod } from "@/lib/db/schema";
import { AppLive } from "@/lib/effect";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
import { Database } from "@/lib/effect/services/database";
import { EmailNotifications } from "@/lib/effect/services/email-notifications";
import { NotificationRepository } from "@/lib/effect/services/notification-repository";
import { StripeServiceTag } from "@/lib/effect/services/stripe";
import { env } from "@/lib/env/client";

// =============================================================================
// POST /api/webhooks/stripe - Handle additional Stripe webhooks
// =============================================================================

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = await headers();
  const signature = headersList.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  const effect = Effect.gen(function* () {
    // Get Stripe service and verify webhook signature
    const stripe = yield* StripeServiceTag;
    const event = yield* stripe.constructWebhookEvent(body, signature);
    const billingRepo = yield* BillingRepository;
    const { db } = yield* Database;

    // Handle the event
    switch (event.type) {
      // Invoice events - track in our local database
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* handleInvoicePaid(invoice, billingRepo, db);
        console.log(`[Webhook] Invoice ${invoice.id} paid`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* handleInvoiceFailed(invoice, db);
        console.log(`[Webhook] Invoice ${invoice.id} payment failed`);
        break;
      }

      case "invoice.created": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* handleInvoiceCreated(invoice, billingRepo);
        console.log(`[Webhook] Invoice ${invoice.id} created`);
        break;
      }

      case "invoice.updated": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* handleInvoiceUpdated(invoice, billingRepo);
        console.log(`[Webhook] Invoice ${invoice.id} updated`);
        break;
      }

      // Payment method events
      case "payment_method.attached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        yield* handlePaymentMethodAttached(paymentMethod, billingRepo);
        console.log(`[Webhook] Payment method ${paymentMethod.id} attached`);
        break;
      }

      case "payment_method.detached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        yield* billingRepo.deletePaymentMethod(paymentMethod.id);
        console.log(`[Webhook] Payment method ${paymentMethod.id} detached`);
        break;
      }

      // Trial ending notification
      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        yield* handleTrialEnding(subscription, db);
        console.log(`[Webhook] Trial ending notification sent for subscription ${subscription.id}`);
        break;
      }

      default:
        // Other events are handled by Better Auth Stripe at /api/auth/stripe/webhook
        console.log(`[Webhook] Event ${event.type} - handled by Better Auth or ignored`);
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
        if (err && typeof err === "object" && "_tag" in err) {
          if (err._tag === "WebhookSignatureError") {
            return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
          }
        }
        console.error("[Webhook Error]", err);
      }
      return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    },
    onSuccess: (data) => NextResponse.json(data),
  });
}

// =============================================================================
// Types
// =============================================================================

type BillingRepoType = typeof BillingRepository.Service;
type DbType = Awaited<ReturnType<typeof import("@/lib/db").db.query.organizations.findFirst>>;

// =============================================================================
// Helper Functions
// =============================================================================

const mapStripeInvoiceStatus = (status: string | null): InvoiceStatus => {
  if (!status) return "draft";
  const statusMap: Record<string, InvoiceStatus> = {
    draft: "draft",
    open: "open",
    paid: "paid",
    void: "void",
    uncollectible: "uncollectible",
  };
  return statusMap[status] ?? "open";
};

// Get metadata reference ID from invoice
const getInvoiceReferenceId = (invoice: Stripe.Invoice): string | undefined => {
  // Try subscription_details metadata first
  if (invoice.subscription_details?.metadata?.referenceId) {
    return invoice.subscription_details.metadata.referenceId;
  }
  // Fall back to checking the subscription metadata directly
  if (typeof invoice.subscription === "object" && invoice.subscription?.metadata?.referenceId) {
    return invoice.subscription.metadata.referenceId;
  }
  return undefined;
};

// =============================================================================
// Invoice Handlers
// =============================================================================

const handleInvoicePaid = (
  stripeInvoice: Stripe.Invoice,
  billingRepo: BillingRepoType,
  db: typeof import("@/lib/db").db,
) =>
  Effect.gen(function* () {
    if (!stripeInvoice.subscription) return;

    const organizationId = getInvoiceReferenceId(stripeInvoice);
    if (!organizationId) {
      console.log("[Webhook] No organizationId in invoice metadata");
      return;
    }

    const paymentIntentId =
      typeof stripeInvoice.payment_intent === "string"
        ? stripeInvoice.payment_intent
        : stripeInvoice.payment_intent?.id;

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
    yield* sendPaymentNotification(organizationId, "payment_succeeded", db);
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

const handleInvoiceFailed = (stripeInvoice: Stripe.Invoice, db: typeof import("@/lib/db").db) =>
  Effect.gen(function* () {
    if (!stripeInvoice.subscription) return;

    const organizationId = getInvoiceReferenceId(stripeInvoice);
    if (!organizationId) return;

    // Send payment failed notification
    yield* sendPaymentNotification(organizationId, "payment_failed", db);
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
        paidAt: stripeInvoice.status === "paid" ? new Date() : undefined,
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
  eventType: "payment_succeeded" | "payment_failed",
  db: typeof import("@/lib/db").db,
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
      catch: () => new Error("Failed to get organization"),
    });

    if (!org) return;

    // Get organization owners
    const ownerMembers = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findMany({
          where: (m, { and, eq: colEq }) => and(colEq(m.organizationId, organizationId), colEq(m.role, "owner")),
          with: { user: true },
        }),
      catch: () => new Error("Failed to get organization members"),
    });

    const notificationTitles = {
      payment_succeeded: "Payment successful",
      payment_failed: "Payment failed",
    };

    const notificationBodies = {
      payment_succeeded: `Your payment for ${org.name} was processed successfully.`,
      payment_failed: `We couldn't process your payment for ${org.name}. Please update your payment method.`,
    };

    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const member of ownerMembers) {
      const user = (member as { user: { id: string; email: string; name: string } }).user;
      if (!user?.email) continue;

      // Create in-app notification
      yield* notificationRepo.createNotification({
        userId: user.id,
        type: eventType,
        title: notificationTitles[eventType],
        body: notificationBodies[eventType],
        resourceType: "subscription",
        resourceId: organizationId,
      });

      // Send email notification
      yield* emailService
        .sendSubscriptionNotification({
          recipientEmail: user.email,
          recipientName: user.name || "there",
          organizationName: org.name,
          eventType,
          billingUrl: `${baseUrl}/${org.slug}/settings/billing`,
        })
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
    }
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

// =============================================================================
// Trial Ending Handler
// =============================================================================

const handleTrialEnding = (subscription: Stripe.Subscription, db: typeof import("@/lib/db").db) =>
  Effect.gen(function* () {
    const notificationRepo = yield* NotificationRepository;
    const emailService = yield* EmailNotifications;

    const organizationId = subscription.metadata?.referenceId;
    if (!organizationId) return;

    // Get organization and members
    const org = yield* Effect.tryPromise({
      try: () =>
        db.query.organizations.findFirst({
          where: (o, { eq }) => eq(o.id, organizationId),
        }),
      catch: () => new Error("Failed to get organization"),
    });

    if (!org) return;

    const members = yield* Effect.tryPromise({
      try: () =>
        db.query.members.findMany({
          where: (m, { and, eq }) => and(eq(m.organizationId, organizationId), eq(m.role, "owner")),
          with: { user: true },
        }),
      catch: () => new Error("Failed to get members"),
    });

    const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const member of members) {
      const user = (member as { user: { id: string; email: string; name: string } }).user;
      if (!user?.email) continue;

      yield* notificationRepo.createNotification({
        userId: user.id,
        type: "trial_ending",
        title: "Your trial is ending soon",
        body: `Your trial for ${org.name} ends on ${trialEndsAt.toLocaleDateString()}. Upgrade now to keep access to all features.`,
        resourceType: "subscription",
        resourceId: subscription.id,
      });

      yield* emailService
        .sendTrialEndingNotification({
          recipientEmail: user.email,
          recipientName: user.name || "there",
          organizationName: org.name,
          trialEndsAt,
          upgradeUrl: `${baseUrl}/${org.slug}/settings/billing`,
        })
        .pipe(Effect.catchAll(() => Effect.succeed(undefined)));
    }
  }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

// Disable body parsing so we can access the raw body for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
