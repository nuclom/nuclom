import { Cause, Effect, Exit, Option } from "effect";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { AppLive } from "@/lib/effect";
import { Billing } from "@/lib/effect/services/billing";
import { StripeServiceTag } from "@/lib/effect/services/stripe";
import {
  handleSubscriptionCreatedWorkflow,
  handleSubscriptionUpdatedWorkflow,
  handleSubscriptionDeletedWorkflow,
  handleInvoicePaidWorkflow,
  handleInvoiceFailedWorkflow,
  handleTrialEndingWorkflow,
} from "@/workflows/stripe-webhooks";

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

          // Handle subscription creation in Effect (for immediate DB update)
          yield* billing.handleSubscriptionCreated(subscription, organizationId);

          // Trigger durable workflow for notifications and trial reminders
          handleSubscriptionCreatedWorkflow({
            eventId: event.id,
            eventType: event.type,
            data: { subscription, organizationId },
          }).catch((err) => {
            console.error("[Webhook Workflow Error]", err);
          });

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

          // Trigger durable workflow
          handleSubscriptionCreatedWorkflow({
            eventId: event.id,
            eventType: event.type,
            data: { subscription, organizationId },
          }).catch((err) => {
            console.error("[Webhook Workflow Error]", err);
          });

          console.log(`[Webhook] Subscription created for org ${organizationId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        yield* billing.handleSubscriptionUpdated(subscription);

        // Trigger durable workflow
        handleSubscriptionUpdatedWorkflow({
          eventId: event.id,
          eventType: event.type,
          data: subscription,
        }).catch((err) => {
          console.error("[Webhook Workflow Error]", err);
        });

        console.log(`[Webhook] Subscription ${subscription.id} updated`);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        yield* billing.handleSubscriptionDeleted(subscription);

        // Trigger durable workflow for notifications
        handleSubscriptionDeletedWorkflow({
          eventId: event.id,
          eventType: event.type,
          data: subscription,
        }).catch((err) => {
          console.error("[Webhook Workflow Error]", err);
        });

        console.log(`[Webhook] Subscription ${subscription.id} deleted`);
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* billing.handleInvoicePaid(invoice);

        // Trigger durable workflow
        handleInvoicePaidWorkflow({
          eventId: event.id,
          eventType: event.type,
          data: invoice,
        }).catch((err) => {
          console.error("[Webhook Workflow Error]", err);
        });

        console.log(`[Webhook] Invoice ${invoice.id} paid`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        yield* billing.handleInvoiceFailed(invoice);

        // Trigger durable workflow for notifications
        handleInvoiceFailedWorkflow({
          eventId: event.id,
          eventType: event.type,
          data: invoice,
        }).catch((err) => {
          console.error("[Webhook Workflow Error]", err);
        });

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

        // Trigger durable workflow for trial ending notifications
        handleTrialEndingWorkflow({
          eventId: event.id,
          eventType: event.type,
          data: subscription,
        }).catch((err) => {
          console.error("[Webhook Workflow Error]", err);
        });

        console.log(`[Webhook] Trial ending notification sent for subscription ${subscription.id}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  });

// Disable body parsing so we can access the raw body for signature verification
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
