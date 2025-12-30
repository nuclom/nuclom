import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, apiKey, mcp, organization } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env/server";
import { db } from "./db";
import { members } from "./db/schema";
import { resend } from "./email";

export const auth = betterAuth({
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
        return false;
      },
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      async sendInvitationEmail(data) {
        const inviteLink = `https://nuclom.com/accept-invitation/${data.id}`;

        await resend.emails.send({
          from: "no-reply@nuclom.com",
          to: data.email,
          subject: `You're invited to join ${data.organization.name}`,
          html: `<p>Hi there,</p>
                 <p>${data.inviter.user.name} has invited you to join the organization ${data.organization.name}.</p>
                 <p>Please click the link below to accept the invitation:</p>
                 <p><a href="${inviteLink}">Accept Invitation</a></p>
                 <p>Thank you!</p>`,
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
  ],
});
