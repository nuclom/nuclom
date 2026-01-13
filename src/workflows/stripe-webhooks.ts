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

import type Stripe from 'stripe';
import { FatalError } from 'workflow';
import { trialReminderWorkflow } from './trial-reminders';

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
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { members, users } = await import('@/lib/db/schema');

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
  'use step';

  const { resend } = await import('@/lib/email');
  const { env } = await import('@/lib/env/server');
  const fromEmail = env.RESEND_FROM_EMAIL ?? 'notifications@nuclom.com';

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
// Additional Helper Steps
// =============================================================================

/**
 * Get organization details step.
 */
async function getOrganizationDetails(organizationId: string) {
  'use step';

  const { db } = await import('@/lib/db');

  return db.query.organizations.findFirst({
    where: (o, { eq: eqOp }) => eqOp(o.id, organizationId),
  });
}

/**
 * Create in-app notification step.
 */
async function createInAppNotification(
  userId: string,
  type:
    | 'comment_reply'
    | 'comment_mention'
    | 'new_comment_on_video'
    | 'video_shared'
    | 'video_processing_complete'
    | 'video_processing_failed'
    | 'invitation_received'
    | 'trial_ending'
    | 'subscription_created'
    | 'subscription_updated'
    | 'subscription_canceled'
    | 'payment_failed'
    | 'payment_succeeded',
  title: string,
  body: string,
  resourceType: string,
  resourceId: string,
): Promise<void> {
  'use step';

  const { db } = await import('@/lib/db');
  const { notifications } = await import('@/lib/db/schema');

  await db.insert(notifications).values({
    userId,
    type,
    title,
    body,
    resourceType,
    resourceId,
  });
}

/**
 * Get subscription by Stripe ID step.
 */
async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  'use step';

  const { db } = await import('@/lib/db');

  return db.query.subscriptions.findFirst({
    where: (s, { eq: eqOp }) => eqOp(s.stripeSubscriptionId, stripeSubscriptionId),
  });
}

/**
 * Update subscription status step.
 */
async function updateSubscriptionStatus(
  stripeSubscriptionId: string,
  status: string,
  canceledAt?: Date,
): Promise<void> {
  'use step';

  const { eq } = await import('drizzle-orm');
  const { db } = await import('@/lib/db');
  const { subscriptions } = await import('@/lib/db/schema');

  await db
    .update(subscriptions)
    .set({
      status,
      canceledAt: canceledAt || undefined,
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

// =============================================================================
// Subscription Created Workflow
// =============================================================================

export async function handleSubscriptionCreatedWorkflow(
  input: StripeWebhookInput<{ subscription: Stripe.Subscription; organizationId: string }>,
): Promise<StripeWebhookResult> {
  'use workflow';

  const { eventId, data } = input;
  const { subscription, organizationId } = data;

  // Step 1: Get organization details
  const org = await getOrganizationDetails(organizationId);

  if (!org) {
    throw new FatalError(`Organization ${organizationId} not found`);
  }

  // Step 2: Get organization owners
  const owners = await getOrganizationOwners(organizationId);

  // Get base URL for links
  const { getAppUrl } = await import('@/lib/env/server');
  const baseUrl = getAppUrl();

  // Step 3: Send notifications to each owner
  for (const owner of owners) {
    if (!owner.email) continue;

    // Create in-app notification
    await createInAppNotification(
      owner.userId,
      'subscription_created',
      'Welcome to Nuclom Pro!',
      `Your subscription for ${org.name} is now active. Enjoy all premium features!`,
      'subscription',
      subscription.id,
    );

    // Send email
    await sendSubscriptionEmail(owner.email, owner.name || 'there', 'Welcome to Nuclom Pro!', {
      title: 'Welcome to Nuclom Pro!',
      message: `Your subscription for ${org.name} is now active.`,
      highlight: "<p style='margin: 0;'>Thank you for subscribing! You now have access to all premium features.</p>",
      highlightClass: 'success',
      buttonText: 'Get Started',
      buttonUrl: `${baseUrl}/${org.slug}`,
    });
  }

  // Step 4: If this is a trial, start the reminder workflow
  if (subscription.trial_end) {
    const dbSubscription = await getSubscriptionByStripeId(subscription.id);

    if (dbSubscription) {
      await trialReminderWorkflow({
        subscriptionId: dbSubscription.id,
        trialEndsAt: new Date(subscription.trial_end * 1000),
      });
    }
  }

  return { success: true, eventId };
}

// =============================================================================
// Subscription Updated Workflow
// =============================================================================

export async function handleSubscriptionUpdatedWorkflow(
  input: StripeWebhookInput<Stripe.Subscription>,
): Promise<StripeWebhookResult> {
  'use workflow';

  const { eventId } = input;

  // DB update is handled by billing.handleSubscriptionUpdated
  // This workflow exists for observability and potential future notification needs
  return { success: true, eventId };
}

// =============================================================================
// Subscription Deleted Workflow
// =============================================================================

export async function handleSubscriptionDeletedWorkflow(
  input: StripeWebhookInput<Stripe.Subscription>,
): Promise<StripeWebhookResult> {
  'use workflow';

  const { eventId, data: subscription } = input;

  // Step 1: Update subscription status to canceled
  await updateSubscriptionStatus(subscription.id, 'canceled', new Date());

  // Step 2: Get subscription details
  const dbSubscription = await getSubscriptionByStripeId(subscription.id);

  if (!dbSubscription || !dbSubscription.referenceId) {
    return { success: true, eventId };
  }

  // Step 3: Get organization details
  const organizationId = dbSubscription.referenceId;
  const org = await getOrganizationDetails(organizationId);

  if (!org) {
    return { success: true, eventId };
  }

  // Step 4: Notify organization owners
  const owners = await getOrganizationOwners(organizationId);

  const { getAppUrl } = await import('@/lib/env/server');
  const baseUrl = getAppUrl();

  for (const owner of owners) {
    if (!owner.email) continue;

    await createInAppNotification(
      owner.userId,
      'subscription_canceled',
      'Subscription Canceled',
      `Your subscription for ${org.name} has been canceled.`,
      'subscription',
      subscription.id,
    );

    await sendSubscriptionEmail(owner.email, owner.name || 'there', 'Subscription Canceled', {
      title: 'Subscription Canceled',
      message: `Your subscription for ${org.name} has been canceled.`,
      highlight:
        "<p style='margin: 0;'>Your subscription will remain active until the end of your current billing period.</p>",
      highlightClass: 'warning',
      buttonText: 'Reactivate Subscription',
      buttonUrl: `${baseUrl}/${org.slug}/settings/billing`,
    });
  }

  return { success: true, eventId };
}

// =============================================================================
// Invoice Paid Workflow
// =============================================================================

export async function handleInvoicePaidWorkflow(
  input: StripeWebhookInput<Stripe.Invoice>,
): Promise<StripeWebhookResult> {
  'use workflow';

  const { eventId } = input;

  // DB update is handled by billing.handleInvoicePaid
  // This workflow exists for observability
  return { success: true, eventId };
}

// =============================================================================
// Invoice Failed Workflow
// =============================================================================

export async function handleInvoiceFailedWorkflow(
  input: StripeWebhookInput<Stripe.Invoice & { stripeSubscriptionId?: string }>,
): Promise<StripeWebhookResult> {
  'use workflow';

  const { eventId, data: invoice } = input;

  // DB update is handled by billing.handleInvoiceFailed
  // Get the subscription ID from the invoice metadata if available
  const subscriptionId = invoice.stripeSubscriptionId;

  if (!subscriptionId) {
    return { success: true, eventId };
  }

  // Step 1: Get subscription details
  const dbSubscription = await getSubscriptionByStripeId(subscriptionId);

  if (!dbSubscription || !dbSubscription.referenceId) {
    return { success: true, eventId };
  }

  // Step 2: Get organization details
  const invoiceOrgId = dbSubscription.referenceId;
  const org = await getOrganizationDetails(invoiceOrgId);

  if (!org) {
    return { success: true, eventId };
  }

  // Step 3: Notify organization owners
  const owners = await getOrganizationOwners(invoiceOrgId);

  const { getAppUrl } = await import('@/lib/env/server');
  const baseUrl = getAppUrl();

  for (const owner of owners) {
    if (!owner.email) continue;

    await createInAppNotification(
      owner.userId,
      'payment_failed',
      'Payment Failed',
      `We couldn't process your payment for ${org.name}. Please update your payment method.`,
      'subscription',
      subscriptionId,
    );

    await sendSubscriptionEmail(owner.email, owner.name || 'there', 'Action Required: Payment Failed', {
      title: 'Payment Failed',
      message: `We couldn't process your payment for ${org.name}.`,
      highlight:
        "<p style='margin: 0;'><strong>Action Required</strong></p><p style='margin: 8px 0 0 0;'>Please update your payment method to avoid service interruption.</p>",
      highlightClass: 'error',
      buttonText: 'Update Payment Method',
      buttonUrl: `${baseUrl}/${org.slug}/settings/billing`,
    });
  }

  return { success: true, eventId };
}

// =============================================================================
// Trial Ending Workflow
// =============================================================================

export async function handleTrialEndingWorkflow(
  input: StripeWebhookInput<Stripe.Subscription>,
): Promise<StripeWebhookResult> {
  'use workflow';

  const { eventId, data: subscription } = input;

  // Step 1: Get subscription details
  const dbSubscription = await getSubscriptionByStripeId(subscription.id);

  if (!dbSubscription || !dbSubscription.referenceId) {
    return { success: true, eventId };
  }

  // Step 2: Get organization details
  const trialOrgId = dbSubscription.referenceId;
  const org = await getOrganizationDetails(trialOrgId);

  if (!org) {
    return { success: true, eventId };
  }

  // Step 3: Get organization owners
  const owners = await getOrganizationOwners(trialOrgId);

  const { getAppUrl } = await import('@/lib/env/server');
  const baseUrl = getAppUrl();
  const trialEndsAt = subscription.trial_end ? new Date(subscription.trial_end * 1000) : new Date();
  const daysLeft = Math.ceil((trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  // Step 4: Send notifications to each owner
  for (const owner of owners) {
    if (!owner.email) continue;

    await createInAppNotification(
      owner.userId,
      'trial_ending',
      'Your trial is ending soon',
      `Your trial for ${org.name} ends in ${daysLeft} days. Upgrade now to keep access to all features.`,
      'subscription',
      subscription.id,
    );

    await sendSubscriptionEmail(owner.email, owner.name || 'there', `Your Nuclom trial ends in ${daysLeft} days`, {
      title: 'Your trial is ending soon',
      message: `Your trial for ${org.name} is ending soon!`,
      highlight: `<p style='margin: 0;'><strong>${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining</strong></p><p style='margin: 8px 0 0 0;'>Your trial will end on ${trialEndsAt.toLocaleDateString()}.</p>`,
      highlightClass: 'warning',
      buttonText: 'Upgrade Now',
      buttonUrl: `${baseUrl}/${org.slug}/settings/billing`,
    });
  }

  return { success: true, eventId };
}
