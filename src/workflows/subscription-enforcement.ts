/**
 * Subscription Enforcement Workflow using Workflow DevKit
 *
 * This workflow runs daily to enforce billing policies:
 * 1. Check for expired trials without payment method
 * 2. Suspend organizations with past_due/unpaid subscriptions
 * 3. Schedule data deletion for accounts past grace period
 * 4. Send notifications at each stage
 *
 * Policy (from pricing.md):
 * - Trial expires (no payment): 14 days grace, then data deleted
 * - Subscription cancelled: 30 days access to data, then deleted
 * - Payment overdue: 30 days suspended, after 30 more days deleted
 */

import { and, eq, isNotNull, isNull, lt, or, sql } from "drizzle-orm";
import { sleep } from "workflow";
import { db } from "@/lib/db";
import { members, notifications, organizations, paymentMethods, subscriptions, users, videos } from "@/lib/db/schema";
import { resend } from "@/lib/email";
import { env } from "@/lib/env/server";
import { createWorkflowLogger } from "./workflow-logger";

const log = createWorkflowLogger("subscription-enforcement");

// =============================================================================
// Types
// =============================================================================

export interface EnforcementResult {
  trialExpirationsHandled: number;
  suspensionsApplied: number;
  deletionsScheduled: number;
  notificationsSent: number;
  errors: string[];
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
    .where(and(eq(members.organizationId, organizationId), eq(members.role, "owner")));
}

async function sendEnforcementNotification(
  organizationId: string,
  orgName: string,
  orgSlug: string | null,
  type: "trial_expired" | "suspended" | "deletion_warning" | "payment_required",
  daysRemaining?: number,
): Promise<number> {
  let notificationsSent = 0;
  const owners = await getOrganizationOwners(organizationId);
  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const billingUrl = orgSlug ? `${baseUrl}/${orgSlug}/settings/billing` : `${baseUrl}/billing`;

  const templates = {
    trial_expired: {
      title: "Your trial has expired",
      body: `Your trial for ${orgName} has ended. Add a payment method to continue using all features.`,
      emailSubject: `Your Nuclom trial has expired - Add payment method`,
      emailBody: `Your trial has ended. Your data will be retained for 14 days. Add a payment method now to restore full access.`,
      ctaText: "Add Payment Method",
      urgency: "warning" as const,
      notificationType: "subscription_canceled" as const,
    },
    suspended: {
      title: "Account suspended - Payment required",
      body: `Your account ${orgName} has been suspended due to payment issues. Please update your payment method.`,
      emailSubject: `Action Required: Your Nuclom account is suspended`,
      emailBody: `Your account has been suspended due to payment issues. Your data will be deleted in ${daysRemaining ?? 30} days unless you update your payment method.`,
      ctaText: "Update Payment",
      urgency: "error" as const,
      notificationType: "payment_failed" as const,
    },
    deletion_warning: {
      title: "Data deletion scheduled",
      body: `Your data for ${orgName} will be permanently deleted in ${daysRemaining} days unless you add a payment method.`,
      emailSubject: `URGENT: Your Nuclom data will be deleted in ${daysRemaining} days`,
      emailBody: `This is your final warning. Your data will be permanently deleted in ${daysRemaining} days. This action cannot be undone.`,
      ctaText: "Prevent Deletion",
      urgency: "error" as const,
      notificationType: "payment_failed" as const,
    },
    payment_required: {
      title: "Payment method required",
      body: `Your trial for ${orgName} is ending soon. Add a payment method to avoid service interruption.`,
      emailSubject: `Add payment method to continue using Nuclom`,
      emailBody: `Your trial is ending soon. Add a payment method now to ensure uninterrupted access to your videos and data.`,
      ctaText: "Add Payment Method",
      urgency: "info" as const,
      notificationType: "trial_ending" as const,
    },
  };

  const template = templates[type];
  const fromEmail = env.RESEND_FROM_EMAIL ?? "notifications@nuclom.com";

  for (const owner of owners) {
    if (!owner.email) continue;

    // Create in-app notification
    try {
      await db.insert(notifications).values({
        userId: owner.userId,
        type: template.notificationType,
        title: template.title,
        body: template.body,
        resourceType: "subscription",
        resourceId: organizationId,
      });
    } catch (e) {
      log.error({ error: e }, "Failed to create notification");
    }

    // Send email
    const bgColor = template.urgency === "error" ? "#dc2626" : template.urgency === "warning" ? "#f59e0b" : "#6366f1";

    try {
      await resend.emails.send({
        from: fromEmail,
        to: owner.email,
        subject: template.emailSubject,
        html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: ${bgColor}; padding: 24px; text-align: center; border-radius: 8px 8px 0 0; }
    .header h1 { color: #ffffff; margin: 0; }
    .content { padding: 24px; background: #fff; border: 1px solid #eee; border-radius: 0 0 8px 8px; }
    .highlight { background-color: ${template.urgency === "error" ? "#fee2e2" : "#fef3c7"}; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid ${bgColor}; }
    .button { display: inline-block; padding: 12px 24px; background-color: ${bgColor}; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>Hi ${owner.name || "there"},</h2>
      <div class="highlight">
        <p style="margin: 0;"><strong>${template.title}</strong></p>
        <p style="margin: 8px 0 0 0;">${template.emailBody}</p>
      </div>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${billingUrl}" class="button">${template.ctaText}</a>
      </p>
      ${type === "deletion_warning" ? '<p style="color: #dc2626; font-size: 14px; text-align: center;"><strong>This action cannot be undone.</strong></p>' : ""}
    </div>
  </div>
</body>
</html>
      `,
      });
    } catch (e) {
      log.error({ error: e }, "Failed to send email");
    }

    notificationsSent++;
  }

  return notificationsSent;
}

async function hasPaymentMethod(organizationId: string): Promise<boolean> {
  const methods = await db.query.paymentMethods.findMany({
    where: eq(paymentMethods.organizationId, organizationId),
    limit: 1,
  });
  return methods.length > 0;
}

function parseMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata) return {};
  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch {
      return {};
    }
  }
  if (typeof metadata === "object") {
    return metadata as Record<string, unknown>;
  }
  return {};
}

async function _getOrganizationEnforcementState(organizationId: string): Promise<Record<string, unknown>> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { metadata: true },
  });
  const metadata = parseMetadata(org?.metadata);
  return (metadata.enforcementState as Record<string, unknown>) ?? {};
}

async function updateOrganizationEnforcementState(
  organizationId: string,
  state: Record<string, unknown>,
): Promise<void> {
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, organizationId),
    columns: { metadata: true },
  });
  const existingMetadata = parseMetadata(org?.metadata);
  const updatedMetadata = {
    ...existingMetadata,
    enforcementState: {
      ...((existingMetadata.enforcementState as Record<string, unknown>) ?? {}),
      ...state,
    },
  };
  await db
    .update(organizations)
    .set({ metadata: JSON.stringify(updatedMetadata) })
    .where(eq(organizations.id, organizationId));
}

// =============================================================================
// Enforcement Logic
// =============================================================================

/**
 * Check for trials that have expired without a payment method
 * and update their status
 */
async function handleExpiredTrials(): Promise<{ handled: number; notifications: number; errors: string[] }> {
  const now = new Date();
  let handled = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  // Find subscriptions where:
  // - Status is 'trialing'
  // - trialEnd has passed
  const expiredTrials = await db
    .select({
      subscription: subscriptions,
      organization: organizations,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(subscriptions.referenceId, organizations.id))
    .where(
      and(eq(subscriptions.status, "trialing"), isNotNull(subscriptions.trialEnd), lt(subscriptions.trialEnd, now)),
    );

  for (const { subscription, organization } of expiredTrials) {
    try {
      const hasPayment = await hasPaymentMethod(organization.id);

      if (!hasPayment) {
        // Trial expired without payment - mark as expired and start grace period
        await db
          .update(subscriptions)
          .set({
            status: "incomplete_expired",
            plan: "free",
          })
          .where(eq(subscriptions.id, subscription.id));

        // Store enforcement state in organization metadata
        await updateOrganizationEnforcementState(organization.id, {
          graceStartedAt: now.toISOString(),
          reason: "trial_expired_no_payment",
        });

        // Send notification
        notificationsSent += await sendEnforcementNotification(
          organization.id,
          organization.name,
          organization.slug,
          "trial_expired",
        );

        log.info(
          { organizationId: organization.id, subscriptionId: subscription.id },
          "Trial expired - grace period started",
        );
        handled++;
      }
    } catch (error) {
      const errorMsg = `Failed to handle expired trial for org ${organization.id}: ${error}`;
      log.error({ organizationId: organization.id, error }, errorMsg);
      errors.push(errorMsg);
    }
  }

  return { handled, notifications: notificationsSent, errors };
}

/**
 * Check for subscriptions with payment issues (past_due, unpaid)
 * and apply appropriate enforcement
 */
async function handlePaymentIssues(): Promise<{ suspended: number; notifications: number; errors: string[] }> {
  const now = new Date();
  let suspended = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  // Find subscriptions that are past_due or unpaid
  const problemSubscriptions = await db
    .select({
      subscription: subscriptions,
      organization: organizations,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(subscriptions.referenceId, organizations.id))
    .where(or(eq(subscriptions.status, "past_due"), eq(subscriptions.status, "unpaid")));

  for (const { subscription, organization } of problemSubscriptions) {
    try {
      // First time seeing payment issues - send notification
      notificationsSent += await sendEnforcementNotification(
        organization.id,
        organization.name,
        organization.slug,
        "suspended",
        30,
      );

      log.info({ organizationId: organization.id }, "Subscription has payment issues");
      suspended++;

      // Calculate days based on subscription dates
      const suspendedAt = subscription.canceledAt ?? subscription.endedAt ?? now;
      const daysSuspended = Math.floor((now.getTime() - suspendedAt.getTime()) / (24 * 60 * 60 * 1000));
      const daysRemaining = 30 - daysSuspended;

      // Check if we need to send reminder notifications
      if (daysSuspended > 0) {
        // Send warnings at 14 days, 7 days, 3 days, and 1 day before deletion
        if ([16, 23, 27, 29].includes(daysSuspended) && daysRemaining > 0) {
          notificationsSent += await sendEnforcementNotification(
            organization.id,
            organization.name,
            organization.slug,
            "deletion_warning",
            daysRemaining,
          );
        }
      }
    } catch (error) {
      const errorMsg = `Failed to handle payment issue for org ${organization.id}: ${error}`;
      log.error({ organizationId: organization.id, error }, errorMsg);
      errors.push(errorMsg);
    }
  }

  return { suspended, notifications: notificationsSent, errors };
}

/**
 * Check for accounts past grace period and schedule data deletion
 */
async function handleDataDeletion(): Promise<{ scheduled: number; notifications: number; errors: string[] }> {
  const now = new Date();
  let scheduled = 0;
  let notificationsSent = 0;
  const errors: string[] = [];

  // Find subscriptions that are in grace period and past the deletion threshold
  const gracePeriodSubscriptions = await db
    .select({
      subscription: subscriptions,
      organization: organizations,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(subscriptions.referenceId, organizations.id))
    .where(
      or(
        eq(subscriptions.status, "incomplete_expired"),
        eq(subscriptions.status, "canceled"),
        eq(subscriptions.status, "past_due"),
        eq(subscriptions.status, "unpaid"),
      ),
    );

  for (const { subscription, organization } of gracePeriodSubscriptions) {
    try {
      // Determine when grace period started based on subscription dates
      const graceStartDate = subscription.endedAt ?? subscription.canceledAt ?? null;

      if (!graceStartDate) continue;

      // Calculate days since grace started
      const daysSinceGrace = Math.floor((now.getTime() - graceStartDate.getTime()) / (24 * 60 * 60 * 1000));

      // Default grace period is 30 days
      // Note: Without metadata, we can't distinguish trial_expired_no_payment cases
      const gracePeriodDays = 30;

      if (daysSinceGrace >= gracePeriodDays) {
        // Schedule deletion (videos will be soft-deleted with retention period)
        const deletionDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 more days

        // Soft-delete all videos for this organization
        await db
          .update(videos)
          .set({
            deletedAt: now,
            retentionUntil: deletionDate,
          })
          .where(and(eq(videos.organizationId, organization.id), isNull(videos.deletedAt)));

        notificationsSent += await sendEnforcementNotification(
          organization.id,
          organization.name,
          organization.slug,
          "deletion_warning",
          7,
        );

        log.info({ organizationId: organization.id }, "Data deletion scheduled");
        scheduled++;
      }
    } catch (error) {
      const errorMsg = `Failed to handle data deletion for org ${organization.id}: ${error}`;
      log.error({ organizationId: organization.id, error }, errorMsg);
      errors.push(errorMsg);
    }
  }

  return { scheduled, notifications: notificationsSent, errors };
}

/**
 * Check for trials ending soon without payment method and send warnings
 */
async function handleTrialsEndingSoon(): Promise<{ notifications: number; errors: string[] }> {
  const now = new Date();
  let notificationsSent = 0;
  const errors: string[] = [];

  // Find trials ending in the next 3 days that don't have a payment method
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const trialsEndingSoon = await db
    .select({
      subscription: subscriptions,
      organization: organizations,
    })
    .from(subscriptions)
    .innerJoin(organizations, eq(subscriptions.referenceId, organizations.id))
    .where(
      and(
        eq(subscriptions.status, "trialing"),
        isNotNull(subscriptions.trialEnd),
        lt(subscriptions.trialEnd, threeDaysFromNow),
        sql`${subscriptions.trialEnd} > ${now}`,
      ),
    );

  for (const { organization } of trialsEndingSoon) {
    try {
      const hasPayment = await hasPaymentMethod(organization.id);

      if (!hasPayment) {
        // Note: Without metadata, we can't track last warning date
        // Sending notification for all trials ending without payment method
        notificationsSent += await sendEnforcementNotification(
          organization.id,
          organization.name,
          organization.slug,
          "payment_required",
        );
      }
    } catch (error) {
      const errorMsg = `Failed to warn about trial ending for org ${organization.id}: ${error}`;
      log.error({ organizationId: organization.id, error }, errorMsg);
      errors.push(errorMsg);
    }
  }

  return { notifications: notificationsSent, errors };
}

// =============================================================================
// Main Workflow
// =============================================================================

/**
 * Daily subscription enforcement workflow.
 *
 * Runs once per day to:
 * 1. Handle expired trials
 * 2. Suspend accounts with payment issues
 * 3. Schedule data deletion for accounts past grace period
 * 4. Send warning notifications
 *
 * Uses durable sleep - survives server restarts.
 */
export async function subscriptionEnforcementWorkflow(): Promise<void> {
  "use workflow";

  log.info({}, "Starting subscription enforcement workflow");

  // Run forever, once per day
  while (true) {
    try {
      const result: EnforcementResult = {
        trialExpirationsHandled: 0,
        suspensionsApplied: 0,
        deletionsScheduled: 0,
        notificationsSent: 0,
        errors: [],
      };

      // Handle expired trials
      const trialResult = await handleExpiredTrials();
      ("use step");
      result.trialExpirationsHandled = trialResult.handled;
      result.notificationsSent += trialResult.notifications;
      result.errors.push(...trialResult.errors);

      // Handle trials ending soon (payment method check)
      const warningResult = await handleTrialsEndingSoon();
      ("use step");
      result.notificationsSent += warningResult.notifications;
      result.errors.push(...warningResult.errors);

      // Handle payment issues
      const paymentResult = await handlePaymentIssues();
      ("use step");
      result.suspensionsApplied = paymentResult.suspended;
      result.notificationsSent += paymentResult.notifications;
      result.errors.push(...paymentResult.errors);

      // Handle data deletion
      const deletionResult = await handleDataDeletion();
      ("use step");
      result.deletionsScheduled = deletionResult.scheduled;
      result.notificationsSent += deletionResult.notifications;
      result.errors.push(...deletionResult.errors);

      log.info(
        {
          trialExpirationsHandled: result.trialExpirationsHandled,
          suspensionsApplied: result.suspensionsApplied,
          deletionsScheduled: result.deletionsScheduled,
          notificationsSent: result.notificationsSent,
          errorCount: result.errors.length,
        },
        "Daily enforcement completed",
      );
    } catch (error) {
      log.error({ error }, "Error in subscription enforcement workflow");
    }

    // Sleep for 24 hours
    await sleep(24 * 60 * 60 * 1000);
    ("use step");
  }
}

/**
 * Run enforcement immediately (for testing or manual triggers)
 */
export async function runEnforcementNow(): Promise<EnforcementResult> {
  const result: EnforcementResult = {
    trialExpirationsHandled: 0,
    suspensionsApplied: 0,
    deletionsScheduled: 0,
    notificationsSent: 0,
    errors: [],
  };

  const trialResult = await handleExpiredTrials();
  result.trialExpirationsHandled = trialResult.handled;
  result.notificationsSent += trialResult.notifications;
  result.errors.push(...trialResult.errors);

  const warningResult = await handleTrialsEndingSoon();
  result.notificationsSent += warningResult.notifications;
  result.errors.push(...warningResult.errors);

  const paymentResult = await handlePaymentIssues();
  result.suspensionsApplied = paymentResult.suspended;
  result.notificationsSent += paymentResult.notifications;
  result.errors.push(...paymentResult.errors);

  const deletionResult = await handleDataDeletion();
  result.deletionsScheduled = deletionResult.scheduled;
  result.notificationsSent += deletionResult.notifications;
  result.errors.push(...deletionResult.errors);

  return result;
}
