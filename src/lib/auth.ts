import { oauthProvider } from '@better-auth/oauth-provider';
import { passkey } from '@better-auth/passkey';
import { sso } from '@better-auth/sso';
import { stripe } from '@better-auth/stripe';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  apiKey,
  jwt,
  lastLoginMethod,
  multiSession,
  openAPI,
  organization,
  twoFactor,
} from 'better-auth/plugins';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import { ac, organizationRoles } from '@/lib/access-control';
import { env, getAppUrl } from '@/lib/env/server';
import { db } from './db';
import { members, notifications, users } from './db/schema';
import { notifySlackMonitoring } from './effect/services/slack-monitoring';
import { resend } from './email';

// Initialize Stripe client
const stripeClient = new Stripe(env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

// =============================================================================
// CORS Configuration - Strictly define allowed origins
// =============================================================================

/**
 * Build trusted origins with strict validation
 * Only explicitly allowed origins are trusted for cross-origin requests
 *
 * Trusted domains:
 * - Production: nuclom.com
 * - Staging: staging.nuclom.com
 * - Deploy Previews: *.vercel.app (via VERCEL_URL)
 * - Local: localhost:5001
 */
function buildTrustedOrigins(): string[] {
  const origins: string[] = [];

  // Always trust the computed app URL
  origins.push(getAppUrl());

  // Production and staging domains
  origins.push('https://nuclom.com');
  origins.push('https://staging.nuclom.com');

  // Vercel deployment URL (for deploy previews: *.vercel.app)
  if (env.VERCEL_URL) {
    origins.push(`https://${env.VERCEL_URL}`);
  }

  // Production Vercel URL if set
  if (env.VERCEL_PROJECT_PRODUCTION_URL) {
    origins.push(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  }

  // Localhost for development
  if (env.NODE_ENV === 'development') {
    origins.push('http://localhost:5001');
  }

  return [...new Set(origins.filter(Boolean))];
}

const trustedOrigins = buildTrustedOrigins();

const isSecureContext = getAppUrl().startsWith('https://');

export const auth = betterAuth({
  baseURL: getAppUrl(),
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: 'pg',
    usePlural: true,
  }),
  // Redirect auth errors to custom styled error page
  onAPIError: {
    errorURL: '/auth-error',
  },
  emailAndPassword: {
    enabled: true,
    // Skip email verification in development for easier testing
    requireEmailVerification: env.NODE_ENV !== 'development',
    disableSignUp: env.DISABLE_SIGNUPS,
    async sendVerificationEmail({
      user,
      token,
    }: {
      user: { email: string; name?: string | null };
      url: string;
      token: string;
    }) {
      const verificationLink = `${getAppUrl()}/verify-email?token=${token}`;

      await resend.emails.send({
        from: 'Nuclom <no-reply@nuclom.com>',
        to: user.email,
        subject: 'Verify your email address',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Nuclom</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 40px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 16px;">Verify your email address</h2>
              <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Hi ${user.name || 'there'},
              </p>
              <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Thanks for signing up for Nuclom! Please verify your email address by clicking the button below.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${verificationLink}" style="background-color: #000000; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Verify Email Address
                </a>
              </div>
              <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 24px 0 0;">
                If you didn't create an account with Nuclom, you can safely ignore this email.
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 24px 0 0;">
                This verification link will expire in 24 hours.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
              <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${verificationLink}" style="color: #666666; word-break: break-all;">${verificationLink}</a>
              </p>
            </div>
          </div>
        `,
      });
    },
    async sendResetPassword({ user, url }: { user: { email: string; name?: string | null }; url: string }) {
      await resend.emails.send({
        from: 'Nuclom <no-reply@nuclom.com>',
        to: user.email,
        subject: 'Reset your Nuclom password',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Nuclom</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 40px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 16px;">Reset Your Password</h2>
              <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Hi ${user.name || 'there'},
              </p>
              <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                We received a request to reset your password. Click the button below to choose a new password.
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${url}" style="background-color: #000000; color: #ffffff; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #666666; font-size: 14px; line-height: 20px; margin: 24px 0 0;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
              <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 24px 0 0;">
                This link will expire in 1 hour.
              </p>
              <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
              <p style="color: #999999; font-size: 12px; line-height: 18px; margin: 0;">
                If the button doesn't work, copy and paste this link into your browser:<br />
                <a href="${url}" style="color: #666666; word-break: break-all;">${url}</a>
              </p>
            </div>
          </div>
        `,
      });
    },
  },
  socialProviders: {
    github: {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    // Required for OAuth provider plugin when using cookieCache
    storeSessionInDatabase: true,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes cache
    },
  },
  // Secure cookie settings
  advanced: {
    cookiePrefix: 'nuclom',
    useSecureCookies: isSecureContext,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: isSecureContext,
      sameSite: 'lax' as const,
      path: '/',
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          // Get user's first organization as active organization
          const userMembership = await db.select().from(members).where(eq(members.userId, session.userId)).limit(1);

          const activeOrganizationId = userMembership[0]?.organizationId || null;

          return {
            data: {
              ...session,
              activeOrganizationId,
            },
          };
        },
      },
    },
  },
  plugins: [
    admin({
      defaultRole: 'user',
      adminRoles: ['admin'],
      impersonationSessionDuration: 60 * 60, // 1 hour
      defaultBanReason: 'Terms of service violation',
      defaultBanExpiresIn: 60 * 60 * 24 * 7, // 7 days
    }),
    organization({
      // Access control configuration
      ac,
      roles: organizationRoles,
      // Enable dynamic role creation for custom organization roles
      dynamicAccessControl: {
        enabled: true,
        maximumRolesPerOrganization: 10,
      },
      allowUserToCreateOrganization: async () => {
        // Allow all authenticated users to create organizations
        return true;
      },
      organizationLimit: 5,
      creatorRole: 'owner',
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      async sendInvitationEmail(data) {
        const inviteLink = `${getAppUrl()}/accept-invitation/${data.id}`;
        const fromEmail = env.RESEND_FROM_EMAIL || 'notifications@nuclom.com';
        const inviterName = data.inviter.user.name || 'Someone';

        // Create in-app notification if user already exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, data.email),
        });

        if (existingUser) {
          await db.insert(notifications).values({
            userId: existingUser.id,
            type: 'invitation_received',
            title: `You've been invited to ${data.organization.name}`,
            body: `${inviterName} has invited you to join ${data.organization.name} as a ${data.role}.`,
            resourceType: 'organization',
            resourceId: data.organization.id,
            actorId: data.inviter.user.id,
          });
        }

        // Send styled email invitation
        const html = `
<!DOCTYPE html>
<html>
<head>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
  .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
  .header { background-color: #6366f1; padding: 24px; text-align: center; }
  .header h1 { color: #ffffff; margin: 0; font-size: 24px; }
  .content { padding: 32px 24px; }
  .button { display: inline-block; padding: 12px 24px; background-color: #6366f1; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 16px 0; }
  .footer { padding: 24px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #eee; }
  .highlight { background-color: #f8f9fa; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #6366f1; }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Nuclom</h1>
    </div>
    <div class="content">
      <h2>You've been invited!</h2>
      <p><strong>${inviterName}</strong> has invited you to join <strong>${data.organization.name}</strong> as a <strong>${data.role}</strong>.</p>
      <div class="highlight">
        <p style="margin: 0;">Join the team to collaborate on videos, share feedback, and work together seamlessly.</p>
      </div>
      <p style="text-align: center;">
        <a href="${inviteLink}" class="button">Accept Invitation</a>
      </p>
      <p style="color: #666; font-size: 14px;">This invitation will expire in 48 hours.</p>
    </div>
    <div class="footer">
      <p>If you weren't expecting this invitation, you can safely ignore this email.</p>
      <p>&copy; ${new Date().getFullYear()} Nuclom. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

        await resend.emails.send({
          from: fromEmail,
          to: data.email,
          subject: `${inviterName} invited you to join ${data.organization.name} on Nuclom`,
          html,
        });
      },
    }),
    // Better Auth Stripe Plugin for subscription management
    stripe({
      stripeClient,
      stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        // Cancel at period end by default (not immediate cancellation)
        cancelImmediately: false,
        plans: [
          {
            name: 'scale',
            priceId: env.STRIPE_PRICE_ID_SCALE_MONTHLY,
            annualDiscountPriceId: env.STRIPE_PRICE_ID_SCALE_YEARLY,
            limits: {
              storage: 5 * 1024 * 1024 * 1024, // 5GB/user
              videos: 25, // 25/user/month
              members: 25,
              bandwidth: 25 * 1024 * 1024 * 1024, // 25GB/month
            },
            freeTrial: {
              days: 14, // 14-day trial, no credit card required
            },
          },
          {
            name: 'pro',
            priceId: env.STRIPE_PRICE_ID_PRO_MONTHLY,
            annualDiscountPriceId: env.STRIPE_PRICE_ID_PRO_YEARLY,
            limits: {
              storage: 25 * 1024 * 1024 * 1024, // 25GB/user
              videos: 100, // 100/user/month
              members: -1, // Unlimited
              bandwidth: 250 * 1024 * 1024 * 1024, // 250GB/month
            },
            freeTrial: {
              days: 14, // 14-day trial, no credit card required
            },
          },
        ],
        // Authorize organization-based subscriptions
        authorizeReference: async ({ user, referenceId, action: _action }) => {
          // Check if user is owner of the organization
          const membership = await db.query.members.findFirst({
            where: (m, { and, eq: colEq }) =>
              and(colEq(m.userId, user.id), colEq(m.organizationId, referenceId), colEq(m.role, 'owner')),
          });
          return !!membership;
        },
        // Custom checkout params for additional features
        getCheckoutSessionParams: async ({ user: _user, plan: _plan }) => ({
          params: {
            allow_promotion_codes: true,
            billing_address_collection: 'auto',
            tax_id_collection: { enabled: true },
            customer_update: {
              address: 'auto',
              name: 'auto',
            },
          },
        }),
      },
      // Lifecycle hooks for subscription events
      onSubscriptionComplete: async ({
        subscription,
        plan,
        user,
      }: {
        subscription: { id: string };
        plan: { name: string };
        user: { id: string; email: string; name?: string | null };
      }) => {
        const fromEmail = env.RESEND_FROM_EMAIL || 'notifications@nuclom.com';

        // Create in-app notification
        await db.insert(notifications).values({
          userId: user.id,
          type: 'subscription_created',
          title: 'Subscription activated',
          body: `Your ${plan.name} subscription is now active.`,
          resourceType: 'subscription',
          resourceId: subscription.id,
        });

        // Send welcome email
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: `Welcome to Nuclom ${plan.name}!`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #6366f1;">Welcome to Nuclom ${plan.name}!</h1>
              <p>Hi ${user.name || 'there'},</p>
              <p>Your ${plan.name} subscription is now active. Here's what you can do:</p>
              <ul>
                <li>Unlimited video storage and collaboration</li>
                <li>AI-powered video insights and transcription</li>
                <li>Advanced team management</li>
                <li>Priority support</li>
              </ul>
              <p><a href="${getAppUrl()}/dashboard" style="color: #6366f1;">Go to your dashboard</a></p>
            </div>
          `,
        });

        // Send Slack monitoring notification
        await notifySlackMonitoring('subscription_created', {
          userId: user.id,
          userName: user.name || undefined,
          userEmail: user.email,
          planName: plan.name,
        });
      },
      onSubscriptionUpdate: async ({
        subscription,
        plan,
        user,
      }: {
        subscription: { id: string };
        plan?: { name: string } | null;
        user: { id: string; email: string; name?: string | null };
      }) => {
        await db.insert(notifications).values({
          userId: user.id,
          type: 'subscription_updated',
          title: 'Subscription updated',
          body: `Your subscription has been updated to ${plan?.name || 'a new plan'}.`,
          resourceType: 'subscription',
          resourceId: subscription.id,
        });
      },
      onSubscriptionCancel: async ({
        subscription,
        user,
      }: {
        subscription: { id: string; cancelAtPeriodEnd?: boolean | null; periodEnd?: Date | null };
        user: { id: string; email: string; name?: string | null };
      }) => {
        const fromEmail = env.RESEND_FROM_EMAIL || 'notifications@nuclom.com';

        await db.insert(notifications).values({
          userId: user.id,
          type: 'subscription_canceled',
          title: 'Subscription canceled',
          body: subscription.cancelAtPeriodEnd
            ? 'Your subscription will end at the current billing period.'
            : 'Your subscription has been canceled immediately.',
          resourceType: 'subscription',
          resourceId: subscription.id,
        });

        // Send cancellation email
        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: 'Your Nuclom subscription has been canceled',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #333;">We're sorry to see you go</h1>
              <p>Hi ${user.name || 'there'},</p>
              ${
                subscription.cancelAtPeriodEnd
                  ? `<p>Your subscription will remain active until ${subscription.periodEnd ? new Date(subscription.periodEnd).toLocaleDateString() : 'the end of your billing period'}.</p>`
                  : "<p>Your subscription has been canceled and you've been downgraded to the free plan.</p>"
              }
              <p>If you change your mind, you can always resubscribe from your account settings.</p>
              <p>We'd love to hear your feedback on how we can improve.</p>
            </div>
          `,
        });

        // Send Slack monitoring notification
        await notifySlackMonitoring('subscription_canceled', {
          userId: user.id,
          userName: user.name || undefined,
          userEmail: user.email,
        });
      },
      onTrialEnd: async ({
        subscription,
        user,
      }: {
        subscription: { id: string };
        user: { id: string; email: string; name?: string | null };
      }) => {
        const fromEmail = env.RESEND_FROM_EMAIL || 'notifications@nuclom.com';

        await db.insert(notifications).values({
          userId: user.id,
          type: 'trial_ending',
          title: 'Your trial has ended',
          body: 'Your free trial has ended. Upgrade to continue enjoying all features.',
          resourceType: 'subscription',
          resourceId: subscription.id,
        });

        await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: 'Your Nuclom trial has ended',
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #6366f1;">Your trial has ended</h1>
              <p>Hi ${user.name || 'there'},</p>
              <p>Your 14-day free trial has ended. We hope you enjoyed exploring Nuclom's features!</p>
              <p>To continue using all the pro features, please upgrade your subscription.</p>
              <p><a href="${getAppUrl()}/settings/billing" style="display: inline-block; padding: 12px 24px; background-color: #6366f1; color: white; text-decoration: none; border-radius: 6px;">Upgrade Now</a></p>
            </div>
          `,
        });
      },
      // Handle additional Stripe webhook events
      onEvent: async (event) => {
        switch (event.type) {
          case 'invoice.paid': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log(`[Better Auth Stripe] Invoice paid: ${invoice.id}`);
            break;
          }
          case 'invoice.payment_failed': {
            const invoice = event.data.object as Stripe.Invoice;
            console.log(`[Better Auth Stripe] Invoice payment failed: ${invoice.id}`);
            // Additional handling for failed payments
            break;
          }
          default:
            console.log(`[Better Auth Stripe] Unhandled event: ${event.type}`);
        }
      },
    }),
    apiKey({
      apiKeyHeaders: ['x-api-key'],
      defaultKeyLength: 64,
      defaultPrefix: 'nc_',
      keyExpiration: {
        defaultExpiresIn: 60 * 60 * 24 * 30, // 30 days
      },
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 1000, // 1 minute
        maxRequests: 100,
      },
    }),
    // JWT plugin is required for OAuth provider
    jwt(),
    // OAuth 2.1 Provider plugin - allows Nuclom to act as an OAuth provider
    oauthProvider({
      loginPage: '/login',
      consentPage: '/auth/consent',
      // Token expiration settings
      accessTokenExpiresIn: 3600, // 1 hour
      refreshTokenExpiresIn: 604800, // 7 days (use number, not string)
      idTokenExpiresIn: 36000, // 10 hours
      // Supported scopes
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      // Metadata for OAuth clients
      metadata: {
        appName: 'Nuclom',
      },
    }),
    twoFactor({
      issuer: 'Nuclom',
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        length: 10,
        count: 10,
      },
    }),
    passkey({
      rpID: env.NODE_ENV === 'production' ? 'nuclom.com' : 'localhost',
      rpName: 'Nuclom',
      origin: env.NODE_ENV === 'production' ? 'https://nuclom.com' : 'http://localhost:5001',
    }),
    sso({
      // Automatically add users to organizations when they sign in via SSO
      organizationProvisioning: {
        disabled: false,
        defaultRole: 'member',
      },
      // Enable domain verification for automatic account linking
      domainVerification: {
        enabled: true,
      },
    }),
    openAPI(),
    // Track last login method for personalized login experience
    lastLoginMethod({
      storeInDatabase: true,
    }),
    // Allow users to manage multiple concurrent sessions
    multiSession({
      maximumSessions: 5,
    }),
  ],
});

// Export types for Better Auth Stripe
export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = typeof auth.$Infer.Session.user;
