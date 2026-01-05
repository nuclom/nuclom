/**
 * Email Notification Service using Effect-TS
 *
 * Provides email notification functionality using Resend for various events.
 */

import { Context, Data, Effect, Layer } from "effect";
import { resend } from "@/lib/email";
import { env } from "@/lib/env/server";

// =============================================================================
// Types
// =============================================================================

export interface EmailRecipient {
  readonly email: string;
  readonly name?: string;
}

export interface CommentNotificationData {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly commenterName: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly commentPreview: string;
  readonly isReply: boolean;
}

export interface InvitationNotificationData {
  readonly recipientEmail: string;
  readonly inviterName: string;
  readonly organizationName: string;
  readonly inviteUrl: string;
  readonly role: string;
}

export interface VideoProcessingNotificationData {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly videoTitle: string;
  readonly videoUrl: string;
  readonly status: "completed" | "failed";
  readonly errorMessage?: string;
}

export interface TrialEndingNotificationData {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly organizationName: string;
  readonly trialEndsAt: Date;
  readonly upgradeUrl: string;
}

export interface SubscriptionNotificationData {
  readonly recipientEmail: string;
  readonly recipientName: string;
  readonly organizationName: string;
  readonly eventType: "created" | "updated" | "canceled" | "payment_failed" | "payment_succeeded";
  readonly planName?: string;
  readonly billingUrl: string;
}

export class EmailError extends Data.TaggedError("EmailError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Service Interface
// =============================================================================

export interface EmailNotificationServiceInterface {
  readonly sendCommentNotification: (data: CommentNotificationData) => Effect.Effect<void, EmailError>;
  readonly sendInvitationNotification: (data: InvitationNotificationData) => Effect.Effect<void, EmailError>;
  readonly sendVideoProcessingNotification: (data: VideoProcessingNotificationData) => Effect.Effect<void, EmailError>;
  readonly sendTrialEndingNotification: (data: TrialEndingNotificationData) => Effect.Effect<void, EmailError>;
  readonly sendSubscriptionNotification: (data: SubscriptionNotificationData) => Effect.Effect<void, EmailError>;
}

// =============================================================================
// Service Tag
// =============================================================================

export class EmailNotifications extends Context.Tag("EmailNotifications")<
  EmailNotifications,
  EmailNotificationServiceInterface
>() {}

// =============================================================================
// Email Templates
// =============================================================================

const getBaseStyles = () => `
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background-color: #6366f1; padding: 24px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
  .content { padding: 32px 24px; }
  .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
  .button:hover { background-color: #5558e3; }
  .footer { padding: 24px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
  .highlight { background-color: #f8f9fa; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #6366f1; }
  .warning { border-left-color: #f59e0b; }
  .error { border-left-color: #ef4444; }
  .success { border-left-color: #10b981; }
`;

const createCommentEmailHtml = (data: CommentNotificationData): string => {
  const subject = data.isReply ? "replied to your comment" : "commented on your video";
  return `
<!DOCTYPE html>
<html>
<head><style>${getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>
      <p><strong>${data.commenterName}</strong> ${subject} "${data.videoTitle}".</p>
      <div class="highlight">
        <p style="margin: 0; font-style: italic;">"${data.commentPreview}"</p>
      </div>
      <p style="text-align: center;">
        <a href="${data.videoUrl}" class="button">View ${data.isReply ? "Reply" : "Comment"}</a>
      </p>
    </div>
    <div class="footer">
      <p>You're receiving this email because you have notifications enabled for comments on Nuclom.</p>
      <p>&copy; ${new Date().getFullYear()} Nuclom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const createInvitationEmailHtml = (data: InvitationNotificationData): string => `
<!DOCTYPE html>
<html>
<head><style>${getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>You've been invited!</h2>
      <p><strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> as a <strong>${data.role}</strong>.</p>
      <div class="highlight">
        <p style="margin: 0;">Join the team to collaborate on videos, share feedback, and work together seamlessly.</p>
      </div>
      <p style="text-align: center;">
        <a href="${data.inviteUrl}" class="button">Accept Invitation</a>
      </p>
      <p style="color: #666; font-size: 14px;">This invitation will expire in 7 days.</p>
    </div>
    <div class="footer">
      <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} Nuclom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

const createVideoProcessingEmailHtml = (data: VideoProcessingNotificationData): string => {
  const isSuccess = data.status === "completed";
  return `
<!DOCTYPE html>
<html>
<head><style>${getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>
      <p>Your video "${data.videoTitle}" has ${isSuccess ? "finished processing" : "failed to process"}.</p>
      <div class="highlight ${isSuccess ? "success" : "error"}">
        ${
          isSuccess
            ? `<p style="margin: 0;">✅ <strong>Processing Complete!</strong></p>
           <p style="margin: 8px 0 0 0;">Your video is now ready with AI-generated summaries, transcriptions, and more.</p>`
            : `<p style="margin: 0;">❌ <strong>Processing Failed</strong></p>
           <p style="margin: 8px 0 0 0;">${data.errorMessage || "An error occurred during processing. Please try again."}</p>`
        }
      </div>
      <p style="text-align: center;">
        <a href="${data.videoUrl}" class="button">${isSuccess ? "View Video" : "Retry Processing"}</a>
      </p>
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Nuclom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const createTrialEndingEmailHtml = (data: TrialEndingNotificationData): string => {
  const daysLeft = Math.ceil((data.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return `
<!DOCTYPE html>
<html>
<head><style>${getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>Hi ${data.recipientName},</h2>
      <p>Your trial for <strong>${data.organizationName}</strong> is ending soon!</p>
      <div class="highlight warning">
        <p style="margin: 0;">⏰ <strong>${daysLeft} day${daysLeft !== 1 ? "s" : ""} remaining</strong></p>
        <p style="margin: 8px 0 0 0;">Your trial will end on ${data.trialEndsAt.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.</p>
      </div>
      <p>To continue using all the features you love, upgrade your plan before the trial ends.</p>
      <p style="text-align: center;">
        <a href="${data.upgradeUrl}" class="button">Upgrade Now</a>
      </p>
      <p style="color: #666; font-size: 14px;">If you don't upgrade, your account will be downgraded to the free plan and you may lose access to some features.</p>
    </div>
    <div class="footer">
      <p>Questions? Reply to this email and we'll help you out.</p>
      <p>&copy; ${new Date().getFullYear()} Nuclom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

const createSubscriptionEmailHtml = (data: SubscriptionNotificationData): string => {
  const getContent = () => {
    switch (data.eventType) {
      case "created":
        return {
          title: "Welcome to Nuclom Pro!",
          message: `Your subscription to ${data.planName || "Nuclom Pro"} is now active.`,
          highlight: `<p style="margin: 0;">🎉 <strong>Thank you for subscribing!</strong></p><p style="margin: 8px 0 0 0;">You now have access to all premium features.</p>`,
          highlightClass: "success",
          buttonText: "Get Started",
        };
      case "updated":
        return {
          title: "Subscription Updated",
          message: `Your subscription for ${data.organizationName} has been updated.`,
          highlight: `<p style="margin: 0;">✅ <strong>Plan Updated</strong></p><p style="margin: 8px 0 0 0;">Your new plan: ${data.planName || "Updated Plan"}</p>`,
          highlightClass: "",
          buttonText: "View Details",
        };
      case "canceled":
        return {
          title: "Subscription Canceled",
          message: `Your subscription for ${data.organizationName} has been canceled.`,
          highlight: `<p style="margin: 0;">Your subscription will remain active until the end of your current billing period.</p>`,
          highlightClass: "warning",
          buttonText: "Reactivate Subscription",
        };
      case "payment_failed":
        return {
          title: "Payment Failed",
          message: `We couldn't process your payment for ${data.organizationName}.`,
          highlight: `<p style="margin: 0;">❌ <strong>Action Required</strong></p><p style="margin: 8px 0 0 0;">Please update your payment method to avoid service interruption.</p>`,
          highlightClass: "error",
          buttonText: "Update Payment Method",
        };
      case "payment_succeeded":
        return {
          title: "Payment Successful",
          message: `Your payment for ${data.organizationName} was processed successfully.`,
          highlight: `<p style="margin: 0;">✅ <strong>Payment Received</strong></p><p style="margin: 8px 0 0 0;">Thank you for your payment!</p>`,
          highlightClass: "success",
          buttonText: "View Invoice",
        };
    }
  };

  const content = getContent();
  return `
<!DOCTYPE html>
<html>
<head><style>${getBaseStyles()}</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>${content.title}</h2>
      <p>Hi ${data.recipientName},</p>
      <p>${content.message}</p>
      <div class="highlight ${content.highlightClass}">
        ${content.highlight}
      </div>
      <p style="text-align: center;">
        <a href="${data.billingUrl}" class="button">${content.buttonText}</a>
      </p>
    </div>
    <div class="footer">
      <p>If you have any questions about your subscription, please contact our support team.</p>
      <p>&copy; ${new Date().getFullYear()} Nuclom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;
};

// =============================================================================
// Service Implementation
// =============================================================================

const makeEmailNotificationService = Effect.gen(function* () {
  const fromEmail = env.RESEND_FROM_EMAIL ?? "notifications@nuclom.com";

  const sendEmail = (to: string, subject: string, html: string): Effect.Effect<void, EmailError> =>
    Effect.tryPromise({
      try: async () => {
        const result = await resend.emails.send({
          from: fromEmail,
          to,
          subject,
          html,
        });

        if (result.error) {
          throw new Error(result.error.message);
        }
      },
      catch: (error) => new EmailError({ message: `Failed to send email: ${error}`, cause: error }),
    });

  const service: EmailNotificationServiceInterface = {
    sendCommentNotification: (data) => {
      const subject = data.isReply
        ? `${data.commenterName} replied to your comment on "${data.videoTitle}"`
        : `${data.commenterName} commented on "${data.videoTitle}"`;
      const html = createCommentEmailHtml(data);
      return sendEmail(data.recipientEmail, subject, html);
    },

    sendInvitationNotification: (data) => {
      const subject = `${data.inviterName} invited you to join ${data.organizationName} on Nuclom`;
      const html = createInvitationEmailHtml(data);
      return sendEmail(data.recipientEmail, subject, html);
    },

    sendVideoProcessingNotification: (data) => {
      const subject =
        data.status === "completed"
          ? `Your video "${data.videoTitle}" is ready!`
          : `Video processing failed: "${data.videoTitle}"`;
      const html = createVideoProcessingEmailHtml(data);
      return sendEmail(data.recipientEmail, subject, html);
    },

    sendTrialEndingNotification: (data) => {
      const daysLeft = Math.ceil((data.trialEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const subject = `Your Nuclom trial ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`;
      const html = createTrialEndingEmailHtml(data);
      return sendEmail(data.recipientEmail, subject, html);
    },

    sendSubscriptionNotification: (data) => {
      const subjects = {
        created: `Welcome to Nuclom ${data.planName || "Pro"}!`,
        updated: `Your Nuclom subscription has been updated`,
        canceled: `Your Nuclom subscription has been canceled`,
        payment_failed: `Action required: Payment failed for your Nuclom subscription`,
        payment_succeeded: `Payment received for your Nuclom subscription`,
      };
      const subject = subjects[data.eventType];
      const html = createSubscriptionEmailHtml(data);
      return sendEmail(data.recipientEmail, subject, html);
    },
  };

  return service;
});

// =============================================================================
// Service Layer
// =============================================================================

export const EmailNotificationsLive = Layer.effect(EmailNotifications, makeEmailNotificationService);

// =============================================================================
// Helper Effects
// =============================================================================

export const sendCommentNotification = (
  data: CommentNotificationData,
): Effect.Effect<void, EmailError, EmailNotifications> =>
  Effect.flatMap(EmailNotifications, (service) => service.sendCommentNotification(data));

export const sendInvitationNotification = (
  data: InvitationNotificationData,
): Effect.Effect<void, EmailError, EmailNotifications> =>
  Effect.flatMap(EmailNotifications, (service) => service.sendInvitationNotification(data));

export const sendVideoProcessingNotification = (
  data: VideoProcessingNotificationData,
): Effect.Effect<void, EmailError, EmailNotifications> =>
  Effect.flatMap(EmailNotifications, (service) => service.sendVideoProcessingNotification(data));

export const sendTrialEndingNotification = (
  data: TrialEndingNotificationData,
): Effect.Effect<void, EmailError, EmailNotifications> =>
  Effect.flatMap(EmailNotifications, (service) => service.sendTrialEndingNotification(data));

export const sendSubscriptionNotification = (
  data: SubscriptionNotificationData,
): Effect.Effect<void, EmailError, EmailNotifications> =>
  Effect.flatMap(EmailNotifications, (service) => service.sendSubscriptionNotification(data));
