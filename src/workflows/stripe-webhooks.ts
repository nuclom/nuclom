/**
 * Stripe Webhook Handlers using Workflow DevKit
 *
 * Wraps Stripe webhook handlers in durable workflows for reliability.
 * Ensures that subscription updates, notifications, and related
 * operations complete even if there are transient failures.
 *
 * Benefits:
 * - Automatic retries on database/email failures
 * - Guaranteed delivery of notifications
 * - Built-in observability
 * - Resume on server restart
 */

import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { FatalError } from "workflow";
import { db } from "@/lib/db";
import { members, notifications, subscriptions, users } from "@/lib/db/schema";
import { resend } from "@/lib/email";
import { env } from "@/lib/env/server";
import { trialReminderWorkflow } from "./trial-reminders";

// =============================================================================
// Types
// =============================================================================

export interface StripeWebhookInput<T = unknown> {
  eventId: string;
  eventType: string;
  data: T;
}

export interface StripeWebhookResult {
  success: boolean;
  eventId: string;
  error?: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function getOrganizationOwners(organizationId: string) {
  return db
    .select({
      userId: members.userId,
      email: users.email,
      name: users.name,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(members.organizationId, organizationId));
}

async function sendSubscriptionEmail(
  to: string,
  recipientName: string,
  subject: string,
  content: {
    title: string;
    message: string;
    highlight: string;
    highlightClass: string;
    buttonText: string;
    buttonUrl: string;
  },
): Promise<void> {
  const fromEmail = env.RESEND_FROM_EMAIL ?? "notifications@nuclom.com";

  await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #6366f1; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; }
    .content { padding: 24px; background: #fff; border: 1px solid #eee; border-radius: 0 0 8px 8px; }
    .highlight { padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #6366f1; background-color: #f8f9fa; }
    .highlight.success { border-left-color: #10b981; background-color: #ecfdf5; }
    .highlight.warning { border-left-color: #f59e0b; background-color: #fef3c7; }
    .highlight.error { border-left-color: #ef4444; background-color: #fef2f2; }
    .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>${content.title}</h2>
      <p>Hi ${recipientName},</p>
      <p>${content.message}</p>
      <div class="highlight ${content.highlightClass}">
        ${content.highlight}
      </div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${content.buttonUrl}" class="button">${content.buttonText}</a>
      </p>
    </div>
  </div>
</body>
</html>
    `,
  });
}

// =============================================================================
// Subscription Created Workflow
// =============================================================================

export async function handleSubscriptionCreatedWorkflow(
  input: StripeWebhookInput<{ subscription: Stripe.Subscription; organizationId: string }>,
): Promise<StripeWebhookResult> {
  "use workflow";

  const { eventId, data } = input;
  const { subscription, organizationId } = data;

  try {
    // Step 1: Notifications are handled here - DB update is done by the billing service
    // The billing.handleSubscriptionCreated already updates the database
    ("use step");

    // Step 2: Get organization details
    const org = await db.query.organizations.findFirst({
      where: (o, { eq: eqOp }) => eqOp(o.id, organizationId),
    });

    if (!org) {
      throw new FatalError(`Organization ${organizationId} not found`);
    }
    ("use step");

    // Step 3: Get organization owners and send notifications
    const owners = await getOrganizationOwners(organizationId);
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const owner of owners) {
      if (!owner.email) continue;

      // Create in-app notification
      await db.insert(notifications).values({
        userId: owner.userId,
        type: "subscription_created",
        title: "Welcome to Nuclom Pro!",
        body: `Your subscription for ${org.name} is now active. Enjoy all premium features!`,
        resourceType: "subscription",
        resourceId: subscription.id,
      });

      // Send email
      await sendSubscriptionEmail(owner.email, owner.name || "there", "Welcome to Nuclom Pro!", {
        title: "Welcome to Nuclom Pro!",
        message: `Your subscription for ${org.name} is now active.`,
        highlight: "<p style='margin: 0;'>Thank you for subscribing! You now have access to all premium features.</p>",
        highlightClass: "success",
        buttonText: "Get Started",
        buttonUrl: `${baseUrl}/${org.slug}`,
      });
    }
    ("use step");

    // Step 4: If this is a trial, start the reminder workflow
    if (subscription.trial_end) {
      const dbSubscription = await db.query.subscriptions.findFirst({
        where: (s, { eq: eqOp }) => eqOp(s.stripeSubscriptionId, subscription.id),
      });

      if (dbSubscription) {
        await trialReminderWorkflow({
          subscriptionId: dbSubscription.id,
          trialEndsAt: new Date(subscription.trial_end * 1000),
        });
      }
    }

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (error instanceof FatalError) throw error;
    return { success: false, eventId, error: errorMessage };
  }
}

// =============================================================================
// Subscription Updated Workflow
// =============================================================================

export async function handleSubscriptionUpdatedWorkflow(
  input: StripeWebhookInput<Stripe.Subscription>,
): Promise<StripeWebhookResult> {
  "use workflow";

  const { eventId } = input;

  try {
    // DB update is handled by billing.handleSubscriptionUpdated
    // This workflow exists for observability and potential future notification needs
    ("use step");

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, eventId, error: errorMessage };
  }
}

// =============================================================================
// Subscription Deleted Workflow
// =============================================================================

export async function handleSubscriptionDeletedWorkflow(
  input: StripeWebhookInput<Stripe.Subscription>,
): Promise<StripeWebhookResult> {
  "use workflow";

  const { eventId, data: subscription } = input;

  try {
    // Step 1: Update subscription status to canceled
    await db
      .update(subscriptions)
      .set({
        status: "canceled",
        canceledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.stripeSubscriptionId, subscription.id));
    ("use step");

    // Step 2: Get subscription and organization details
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: (s, { eq: eqOp }) => eqOp(s.stripeSubscriptionId, subscription.id),
    });

    if (!dbSubscription || !dbSubscription.organizationId) {
      return { success: true, eventId };
    }

    const organizationId = dbSubscription.organizationId;
    const org = await db.query.organizations.findFirst({
      where: (o, { eq: eqOp }) => eqOp(o.id, organizationId),
    });

    if (!org) {
      return { success: true, eventId };
    }
    ("use step");

    // Step 3: Notify organization owners
    const owners = await getOrganizationOwners(organizationId);
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const owner of owners) {
      if (!owner.email) continue;

      await db.insert(notifications).values({
        userId: owner.userId,
        type: "subscription_canceled",
        title: "Subscription Canceled",
        body: `Your subscription for ${org.name} has been canceled.`,
        resourceType: "subscription",
        resourceId: subscription.id,
      });

      await sendSubscriptionEmail(owner.email, owner.name || "there", "Subscription Canceled", {
        title: "Subscription Canceled",
        message: `Your subscription for ${org.name} has been canceled.`,
        highlight:
          "<p style='margin: 0;'>Your subscription will remain active until the end of your current billing period.</p>",
        highlightClass: "warning",
        buttonText: "Reactivate Subscription",
        buttonUrl: `${baseUrl}/${org.slug}/settings/billing`,
      });
    }

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, eventId, error: errorMessage };
  }
}

// =============================================================================
// Invoice Paid Workflow
// =============================================================================

export async function handleInvoicePaidWorkflow(
  input: StripeWebhookInput<Stripe.Invoice>,
): Promise<StripeWebhookResult> {
  "use workflow";

  const { eventId } = input;

  try {
    // DB update is handled by billing.handleInvoicePaid
    // This workflow exists for observability
    ("use step");

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, eventId, error: errorMessage };
  }
}

// =============================================================================
// Invoice Failed Workflow
// =============================================================================

export async function handleInvoiceFailedWorkflow(
  input: StripeWebhookInput<Stripe.Invoice & { stripeSubscriptionId?: string }>,
): Promise<StripeWebhookResult> {
  "use workflow";

  const { eventId, data: invoice } = input;

  try {
    // DB update is handled by billing.handleInvoiceFailed
    // Get the subscription ID from the invoice metadata if available
    const subscriptionId = invoice.stripeSubscriptionId;

    if (!subscriptionId) {
      return { success: true, eventId };
    }

    // Step 1: Get subscription and organization for notifications
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: (s, { eq: eqOp }) => eqOp(s.stripeSubscriptionId, subscriptionId),
    });

    if (!dbSubscription || !dbSubscription.organizationId) {
      return { success: true, eventId };
    }

    const invoiceOrgId = dbSubscription.organizationId;
    const org = await db.query.organizations.findFirst({
      where: (o, { eq: eqOp }) => eqOp(o.id, invoiceOrgId),
    });

    if (!org) {
      return { success: true, eventId };
    }
    ("use step");

    // Step 2: Notify organization owners
    const owners = await getOrganizationOwners(invoiceOrgId);
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    for (const owner of owners) {
      if (!owner.email) continue;

      await db.insert(notifications).values({
        userId: owner.userId,
        type: "payment_failed",
        title: "Payment Failed",
        body: `We couldn't process your payment for ${org.name}. Please update your payment method.`,
        resourceType: "subscription",
        resourceId: subscriptionId,
      });

      await sendSubscriptionEmail(owner.email, owner.name || "there", "Action Required: Payment Failed", {
        title: "Payment Failed",
        message: `We couldn't process your payment for ${org.name}.`,
        highlight:
          "<p style='margin: 0;'><strong>Action Required</strong></p><p style='margin: 8px 0 0 0;'>Please update your payment method to avoid service interruption.</p>",
        highlightClass: "error",
        buttonText: "Update Payment Method",
        buttonUrl: `${baseUrl}/${org.slug}/settings/billing`,
      });
    }

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, eventId, error: errorMessage };
  }
}

// =============================================================================
// Trial Ending Workflow
// =============================================================================

export async function handleTrialEndingWorkflow(
  input: StripeWebhookInput<Stripe.Subscription>,
): Promise<StripeWebhookResult> {
  "use workflow";

  const { eventId, data: subscription } = input;

  try {
    // The trial reminder workflow handles this, but we can trigger immediate notification
    const dbSubscription = await db.query.subscriptions.findFirst({
      where: (s, { eq: eqOp }) => eqOp(s.stripeSubscriptionId, subscription.id),
    });

    if (!dbSubscription || !dbSubscription.organizationId) {
      return { success: true, eventId };
    }

    const trialOrgId = dbSubscription.organizationId;
    const org = await db.query.organizations.findFirst({
      where: (o, { eq: eqOp }) => eqOp(o.id, trialOrgId),
    });

    if (!org) {
      return { success: true, eventId };
    }

    const owners = await getOrganizationOwners(trialOrgId);
    const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
    const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    for (const owner of owners) {
      if (!owner.email) continue;

      await db.insert(notifications).values({
        userId: owner.userId,
        type: "trial_ending",
        title: "Your trial is ending soon",
        body: `Your trial for ${org.name} ends in ${daysLeft} days. Upgrade now to keep access to all features.`,
        resourceType: "subscription",
        resourceId: subscription.id,
      });

      await sendSubscriptionEmail(owner.email, owner.name || "there", `Your Nuclom trial ends in ${daysLeft} days`, {
        title: "Your trial is ending soon",
        message: `Your trial for ${org.name} is ending soon!`,
        highlight: `<p style='margin: 0;'><strong>${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining</strong></p><p style='margin: 8px 0 0 0;'>Your trial will end on ${trialEndsAt.toLocaleDateString()}.</p>`,
        highlightClass: "warning",
        buttonText: "Upgrade Now",
        buttonUrl: `${baseUrl}/${org.slug}/settings/billing`,
      });
    }

    return { success: true, eventId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, eventId, error: errorMessage };
  }
}
