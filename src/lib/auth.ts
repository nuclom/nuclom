import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin, apiKey, mcp } from "better-auth/plugins";
import { db } from "./db";
import { env } from "@/lib/env/server";
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
    autoSignIn: true
  },
  socialProviders: {
    ...(env.GITHUB_CLIENT_ID &&
      env.GITHUB_CLIENT_SECRET && {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
      },
    }),
    ...(env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET && {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    }),
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  plugins: [
    organization({
      allowUserToCreateOrganization: true,
      organizationLimit: 5,
      creatorRole: "owner",
      membershipLimit: 100,
      invitationExpiresIn: 60 * 60 * 48, // 48 hours
      async sendInvitationEmail(data) {
        const inviteLink = `https://nuclom.com/accept-invitation/${data.id}`

        await resend.emails.send({
          from: 'no-reply@nuclom.com',
          to: data.email,
          subject: `You're invited to join ${data.organization.name}`,
          html: `<p>Hi there,</p>
                 <p>${data.inviter.user.name} has invited you to join the organization ${data.organization.name}.</p>
                 <p>Please click the link below to accept the invitation:</p>
                 <p><a href="${inviteLink}">Accept Invitation</a></p>
                 <p>Thank you!</p>`
        });
      },
    }),
    admin({
      defaultRole: "user",
      adminRoles: ["admin", "owner"],
      impersonationSessionDuration: 60 * 60, // 1 hour
      defaultBanReason: "Terms of service violation",
      defaultBanExpiresIn: 60 * 60 * 24 * 7, // 7 days
    }),
    apiKey({
      apiKeyHeaders: ["x-api-key"],
      defaultKeyLength: 64,
      defaultPrefix: "nuclom_",
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
