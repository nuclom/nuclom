/**
 * Trial Reminder Workflow using Workflow DevKit
 *
 * Sends reminder notifications at specific intervals before a trial ends.
 * Uses the `sleep()` function to schedule reminders without consuming
 * resources during wait periods.
 *
 * Reminder schedule:
 * - 7 days before trial ends
 * - 3 days before trial ends
 * - 1 day before trial ends
 *
 * Benefits:
 * - No external scheduler needed
 * - Survives server restarts
 * - Built-in observability
 * - Resource-efficient sleep
 */

import { eq } from "drizzle-orm";
import { FatalError, sleep } from "workflow";
import { db } from "@/lib/db";
import { members, notifications, users } from "@/lib/db/schema";
import { resend } from "@/lib/email";
import { env } from "@/lib/env/client";
import { env as serverEnv } from "@/lib/env/server";
import { createWorkflowLogger } from "./workflow-logger";

const log = createWorkflowLogger("trial-reminders");

// =============================================================================
// Types
// =============================================================================

export interface TrialReminderInput {
  subscriptionId: string;
  trialEndsAt: Date;
}

export interface TrialReminderResult {
  subscriptionId: string;
  remindersSent: number;
  completed: boolean;
}

// =============================================================================
// Helper Functions
// =============================================================================

async function sendTrialReminder(subscriptionId: string, daysRemaining: number): Promise<void> {
  // Get subscription details
  const subscription = await db.query.subscriptions.findFirst({
    where: (s, { eq: eqOp }) => eqOp(s.id, subscriptionId),
  });

  if (!subscription || !subscription.organizationId) {
    throw new FatalError(`Subscription ${subscriptionId} not found`);
  }

  const orgId = subscription.organizationId;

  // Get organization
  const org = await db.query.organizations.findFirst({
    where: (o, { eq: eqOp }) => eqOp(o.id, orgId),
  });

  if (!org) {
    throw new FatalError(`Organization for subscription ${subscriptionId} not found`);
  }

  // Get organization owners
  const ownerMembers = await db
    .select({
      userId: members.userId,
      email: users.email,
      name: users.name,
    })
    .from(members)
    .innerJoin(users, eq(members.userId, users.id))
    .where(eq(members.organizationId, orgId));

  const baseUrl = env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const upgradeUrl = `${baseUrl}/${org.slug}/settings/billing`;

  for (const owner of ownerMembers) {
    if (!owner.email) continue;

    // Create in-app notification
    await db.insert(notifications).values({
      userId: owner.userId,
      type: "trial_ending",
      title: `Your trial ends in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`,
      body: `Your trial for ${org.name} is ending soon. Upgrade now to keep access to all features.`,
      resourceType: "subscription",
      resourceId: subscriptionId,
    });

    // Send email notification
    const fromEmail = serverEnv.RESEND_FROM_EMAIL ?? "notifications@nuclom.com";

    await resend.emails.send({
      from: fromEmail,
      to: owner.email,
      subject: `Your Nuclom trial ends in ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""}`,
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
    .highlight { background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #f59e0b; }
    .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>Hi ${owner.name || "there"},</h2>
      <p>Your trial for <strong>${org.name}</strong> is ending soon!</p>
      <div class="highlight">
        <p style="margin: 0;"><strong>${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining</strong></p>
        <p style="margin: 8px 0 0 0;">Your trial will end on ${subscription.trialEnd ? new Date(subscription.trialEnd).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "soon"}.</p>
      </div>
      <p>To continue using all the features you love, upgrade your plan before the trial ends.</p>
      <p style="text-align: center; margin: 24px 0;">
        <a href="${upgradeUrl}" class="button">Upgrade Now</a>
      </p>
      <p style="color: #666; font-size: 14px;">If you don't upgrade, your account will be downgraded to the free plan.</p>
    </div>
  </div>
</body>
</html>
      `,
    });
  }

  log.info(
    { subscriptionId, daysRemaining, recipientCount: ownerMembers.length },
    "Sent trial reminder to organization owners",
  );
}

// =============================================================================
// Trial Reminder Workflow
// =============================================================================

/**
 * Schedule and send trial ending reminders at 7, 3, and 1 day intervals.
 *
 * This workflow is started when a trial subscription is created.
 * It calculates the sleep durations needed to wake up at each reminder
 * point and sends notifications to all organization owners.
 *
 * The workflow uses durable sleep - if the server restarts, it will
 * resume and continue from where it left off.
 */
export async function trialReminderWorkflow(input: TrialReminderInput): Promise<TrialReminderResult> {
  "use workflow";

  const { subscriptionId, trialEndsAt } = input;
  const trialEndTime = new Date(trialEndsAt).getTime();
  let remindersSent = 0;

  // Calculate reminder times
  const reminderDays = [7, 3, 1];

  for (const daysBeforeEnd of reminderDays) {
    const reminderTime = trialEndTime - daysBeforeEnd * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Skip if this reminder time has already passed
    if (reminderTime <= now) {
      log.debug({ subscriptionId, daysBeforeEnd: daysBeforeEnd }, "Skipping reminder (already passed)");
      continue;
    }

    // Calculate sleep duration
    const sleepDuration = reminderTime - now;
    const sleepHours = Math.round(sleepDuration / 1000 / 60 / 60);

    log.info({ subscriptionId, daysBeforeEnd: daysBeforeEnd, sleepHours }, "Sleeping until next reminder");

    // Sleep until reminder time
    await sleep(sleepDuration);
    ("use step");

    // Verify subscription still exists and is still on trial
    const subscription = await db.query.subscriptions.findFirst({
      where: (s, { eq: eqOp }) => eqOp(s.id, subscriptionId),
    });

    if (!subscription) {
      log.info({ subscriptionId: subscriptionId }, "Subscription no longer exists, stopping workflow");
      break;
    }

    if (subscription.status !== "trialing") {
      log.info(
        { subscriptionId, status: subscription.status },
        "Subscription is no longer trialing, stopping workflow",
      );
      break;
    }

    // Send the reminder
    try {
      await sendTrialReminder(subscriptionId, daysBeforeEnd);
      remindersSent++;
      ("use step");
    } catch (error) {
      log.error({ subscriptionId, daysBeforeEnd, error }, "Failed to send reminder");
      // Continue to next reminder even if this one fails
    }
  }

  return {
    subscriptionId,
    remindersSent,
    completed: true,
  };
}
