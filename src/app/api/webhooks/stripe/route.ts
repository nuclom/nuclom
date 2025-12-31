import { Cause, Effect, Exit, Option } from "effect";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { AppLive } from "@/lib/effect";
import { Billing } from "@/lib/effect/services/billing";
import { BillingRepository } from "@/lib/effect/services/billing-repository";
import { Database } from "@/lib/effect/services/database";
import { EmailNotifications } from "@/lib/effect/services/email-notifications";
import { NotificationRepository } from "@/lib/effect/services/notification-repository";
import { StripeServiceTag } from "@/lib/effect/services/stripe";
import { env } from "@/lib/env/client";

// =============================================================================
// POST /api/webhooks/stripe - Handle Stripe webhooks
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

    // Handle the event
    yield* handleWebhookEvent(event);

    return { received: true };
  });

  const runnable = Effect.provide(effect, AppLive);
  const exit = await Effect.runPromiseExit(runnable);

  return Exit.match(exit, {
    onFailure: (cause) => {
      const error = Cause.failureOption(cause);
      if (error._tag === "Some") {
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
// Webhook Event Handlers
// =============================================================================

const handleWebhookEvent = (event: Stripe.Event) =>
  Effect.gen(function* () {
    const billing = yield* Billing;

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const organizationId = session.metadata?.organizationId;
          if (!organizationId) {
            console.error("[Webhook] Missing organizationId in checkout session metadata");
            return;
          }

          // Get the subscription from Stripe
          const stripe = yield* StripeServiceTag;
          const subscription = yield* stripe.getSubscription(session.subscription as string);

          yield* billing.handleSubscriptionCreated(subscription, organizationId);
          console.log(`[Webhook] Subscription created for org ${organizationId}`);
        }
        break;
      }

      case "customer.subscription.created": {
        // This is often handled by checkout.session.completed
        // but we include it for direct subscription creations
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organizationId;
        if (organizationId) {
          yield* billing.handleSubscriptionCreated(subscription, organizationId);
          console.log(`[Webhook] Subscription created for org ${organizationId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        yield* billing.handleSubscriptionUpdated(subscription);
        console.log(`[Webhook] Subscription ${subscription.id} updated`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        yield* billing.handleSubscriptionDeleted(subscription);
        console.log(`[Webhook] Subscription ${subscription.id} deleted`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* billing.handleInvoicePaid(invoice);
        console.log(`[Webhook] Invoice ${invoice.id} paid`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* billing.handleInvoiceFailed(invoice);
        console.log(`[Webhook] Invoice ${invoice.id} payment failed`);
        break;
      }

      case "payment_method.attached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        const organizationId = paymentMethod.metadata?.organizationId;
        if (organizationId) {
          yield* billing.handlePaymentMethodAttached(paymentMethod, organizationId);
          console.log(`[Webhook] Payment method attached for org ${organizationId}`);
        }
        break;
      }

      case "payment_method.detached": {
        const paymentMethod = event.data.object as Stripe.PaymentMethod;
        yield* billing.handlePaymentMethodDetached(paymentMethod.id);
        console.log(`[Webhook] Payment method ${paymentMethod.id} detached`);
        break;
      }

      case "customer.subscription.trial_will_end": {
        const subscription = event.data.object as Stripe.Subscription;
        yield* handleTrialEnding(subscription);
        console.log(`[Webhook] Trial ending notification sent for subscription ${subscription.id}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  });

// =============================================================================
// Helper Functions for Notifications
// =============================================================================

const handleTrialEnding = (subscription: Stripe.Subscription) =>
  Effect.gen(function* () {
    const billingRepo = yield* BillingRepository;
    const emailService = yield* EmailNotifications;
    const notificationRepo = yield* NotificationRepository;
    const { db } = yield* Database;

    // Get subscription from database
    const dbSubscription = yield* billingRepo.getSubscriptionByStripeId(subscription.id).pipe(Effect.option);

    if (Option.isNone(dbSubscription)) {
      console.log(`[Webhook] No subscription found for trial ending: ${subscription.id}`);
      return;
    }

    const sub = dbSubscription.value;
    const organizationId = sub.organizationId;

    // Get organization and members to notify
    const org = yield* Effect.tryPromise({
      try: () =>
        db.query.organizations.findFirst({
          where: (orgs, { eq }) => eq(orgs.id, organizationId),
        }),
      catch: () => new Error("Failed to get organization"),
    });

    if (!org) return;

    // Get organization owner(s)
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

    // Send notifications to all owners
    for (const member of members) {
      const user = (member as { user: { id: string; email: string; name: string } }).user;
      if (!user?.email) continue;

      // Create in-app notification
      yield* notificationRepo.createNotification({
        userId: user.id,
        type: "trial_ending",
        title: "Your trial is ending soon",
        body: `Your trial for ${org.name} ends on ${trialEndsAt.toLocaleDateString()}. Upgrade now to keep access to all features.`,
        resourceType: "subscription",
        resourceId: sub.id,
      });

      // Send email notification
      yield* emailService
        .sendTrialEndingNotification({
          recipientEmail: user.email,
          recipientName: user.name || "there",
          organizationName: org.name,
          trialEndsAt,
          upgradeUrl: `${baseUrl}/${org.slug}/settings/billing`,
        })
        .pipe(
          Effect.catchAll((error) => {
            console.error(`[Webhook] Failed to send trial ending email to ${user.email}:`, error);
            return Effect.succeed(undefined);
          }),
        );
    }
  }).pipe(
    Effect.catchAll((error) => {
      console.error("[Webhook] Error handling trial ending:", error);
      return Effect.succeed(undefined);
    }),
  );

// Disable body parsing so we can access the raw body for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
