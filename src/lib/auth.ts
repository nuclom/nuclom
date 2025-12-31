import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, apiKey, mcp, openAPI, organization, twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { eq } from "drizzle-orm";
import { env as clientEnv } from "@/lib/env/client";
import { env } from "@/lib/env/server";
import { db } from "./db";
import { members, notifications, users } from "./db/schema";
import { resend } from "./email";

// Build trusted origins from environment
const trustedOrigins = [env.APP_URL];
// Add Vercel preview URL if available
if (process.env.VERCEL_URL) {
  trustedOrigins.push(`https://${process.env.VERCEL_URL}`);
}
// Add localhost for development
if (process.env.NODE_ENV === "development") {
  trustedOrigins.push("http://localhost:3000");
}

export const auth = betterAuth({
  trustedOrigins,
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    disableSignUp: true,
    async sendVerificationEmail({
      user,
      token,
    }: {
      user: { email: string; name?: string | null };
      url: string;
      token: string;
    }) {
      const verificationLink = `${env.APP_URL}/verify-email?token=${token}`;

      await resend.emails.send({
        from: "Nuclom <no-reply@nuclom.com>",
        to: user.email,
        subject: "Verify your email address",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Nuclom</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 40px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 16px;">Verify your email address</h2>
              <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Hi ${user.name || "there"},
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
    async sendResetPassword({
      user,
      url,
    }: {
      user: { email: string; name?: string | null };
      url: string;
    }) {
      await resend.emails.send({
        from: "Nuclom <no-reply@nuclom.com>",
        to: user.email,
        subject: "Reset your Nuclom password",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1a1a1a; font-size: 24px; margin: 0;">Nuclom</h1>
            </div>
            <div style="background: #ffffff; border: 1px solid #e5e5e5; border-radius: 8px; padding: 40px;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 16px;">Reset Your Password</h2>
              <p style="color: #666666; font-size: 16px; line-height: 24px; margin: 0 0 24px;">
                Hi ${user.name || "there"},
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
      defaultRole: "user",
      adminRoles: ["admin"],
      impersonationSessionDuration: 60 * 60, // 1 hour
      defaultBanReason: "Terms of service violation",
      defaultBanExpiresIn: 60 * 60 * 24 * 7, // 7 days
    }),
    organization({
      allowUserToCreateOrganization: async () => {
        // Allow all authenticated users to create organizations
        return true;
      },
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      async sendInvitationEmail(data) {
        const baseUrl = clientEnv.NEXT_PUBLIC_APP_URL || "https://nuclom.com";
        const inviteLink = `${baseUrl}/accept-invitation/${data.id}`;
        const fromEmail = env.RESEND_FROM_EMAIL || "notifications@nuclom.com";
        const inviterName = data.inviter.user.name || "Someone";

        // Create in-app notification if user already exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, data.email),
        });

        if (existingUser) {
          await db.insert(notifications).values({
            userId: existingUser.id,
            type: "invitation_received",
            title: `You've been invited to ${data.organization.name}`,
            body: `${inviterName} has invited you to join ${data.organization.name} as a ${data.role}.`,
            resourceType: "organization",
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
    apiKey({
      apiKeyHeaders: ["x-api-key"],
      defaultKeyLength: 64,
      defaultPrefix: "nc_",
      keyExpiration: {
        defaultExpiresIn: 60 * 60 * 24 * 30, // 30 days
      },
      rateLimit: {
        enabled: true,
        timeWindow: 60 * 1000, // 1 minute
        maxRequests: 100,
      },
    }),
    mcp({
      loginPage: "/auth/sign-in",
      oidcConfig: {
        loginPage: "/auth/sign-in",
        codeExpiresIn: 600, // 10 minutes
        accessTokenExpiresIn: 3600, // 1 hour
        refreshTokenExpiresIn: 604800, // 7 days
        defaultScope: "openid",
        scopes: ["openid", "profile", "email", "offline_access"],
      },
    }),
    twoFactor({
      issuer: "Nuclom",
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
      rpID: env.NODE_ENV === "production" ? "nuclom.com" : "localhost",
      rpName: "Nuclom",
      origin:
        env.NODE_ENV === "production" ? "https://nuclom.com" : "http://localhost:3000",
    }),
    openAPI(),
  ],
});
