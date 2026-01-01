import { eq } from "drizzle-orm";
import { db } from "./db";
import {
  members,
  ssoConfigurations,
  ssoSessions,
  users,
  type NewSSOConfiguration,
  type NewSSOSession,
  type SSOConfiguration,
  type SSOProviderType,
} from "./db/schema";
import { AuditLogger } from "./audit-log";

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  discoveryUrl?: string;
}

export interface SSOUserInfo {
  externalUserId: string;
  email: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  groups?: string[];
}

export interface SSOAuthResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name: string;
  };
  sessionId?: string;
  error?: string;
}

/**
 * SSO Service - Handles SAML and OIDC authentication for enterprise organizations
 */
// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern
export class SSOService {
  /**
   * Get SSO configuration for an organization
   */
  static async getConfig(organizationId: string): Promise<SSOConfiguration | null> {
    const config = await db.query.ssoConfigurations.findFirst({
      where: eq(ssoConfigurations.organizationId, organizationId),
    });

    return config || null;
  }

  /**
   * Configure SSO for an organization
   */
  static async configure(
    organizationId: string,
    providerType: SSOProviderType,
    config: SAMLConfig | OIDCConfig,
    options?: {
      autoProvision?: boolean;
      defaultRole?: "owner" | "member";
      allowedDomains?: string[];
      attributeMapping?: {
        email?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        groups?: string;
      };
      configuredBy?: string;
    },
  ): Promise<SSOConfiguration> {
    const existingConfig = await this.getConfig(organizationId);

    const ssoConfig: NewSSOConfiguration = {
      id: existingConfig?.id || crypto.randomUUID(),
      organizationId,
      providerType,
      enabled: false, // Must be explicitly enabled after testing
      autoProvision: options?.autoProvision ?? true,
      defaultRole: options?.defaultRole || "member",
      allowedDomains: options?.allowedDomains || null,
      attributeMapping: options?.attributeMapping || null,
    };

    if (providerType === "saml") {
      const samlConfig = config as SAMLConfig;
      ssoConfig.entityId = samlConfig.entityId;
      ssoConfig.ssoUrl = samlConfig.ssoUrl;
      sloUrl: samlConfig.sloUrl || null;
      ssoConfig.certificate = samlConfig.certificate;
    } else {
      const oidcConfig = config as OIDCConfig;
      ssoConfig.issuer = oidcConfig.issuer;
      ssoConfig.clientId = oidcConfig.clientId;
      ssoConfig.clientSecret = oidcConfig.clientSecret;
      ssoConfig.discoveryUrl = oidcConfig.discoveryUrl || null;
    }

    let result: SSOConfiguration;

    if (existingConfig) {
      const [updated] = await db
        .update(ssoConfigurations)
        .set({
          ...ssoConfig,
          updatedAt: new Date(),
        })
        .where(eq(ssoConfigurations.id, existingConfig.id))
        .returning();
      result = updated;
    } else {
      const [created] = await db.insert(ssoConfigurations).values(ssoConfig).returning();
      result = created;
    }

    // Audit log
    if (options?.configuredBy) {
      await AuditLogger.logOrgManagement(
        "sso_configured",
        { actorId: options.configuredBy, organizationId },
        {
          previousValue: existingConfig ? { enabled: existingConfig.enabled, providerType: existingConfig.providerType } : undefined,
          newValue: { enabled: result.enabled, providerType: result.providerType },
        },
      );
    }

    return result;
  }

  /**
   * Enable SSO for an organization
   */
  static async enable(organizationId: string, enabledBy?: string): Promise<void> {
    const config = await this.getConfig(organizationId);

    if (!config) {
      throw new Error("SSO not configured for this organization");
    }

    // Validate configuration before enabling
    if (config.providerType === "saml") {
      if (!config.entityId || !config.ssoUrl || !config.certificate) {
        throw new Error("SAML configuration is incomplete");
      }
    } else {
      if (!config.issuer || !config.clientId || !config.clientSecret) {
        throw new Error("OIDC configuration is incomplete");
      }
    }

    await db
      .update(ssoConfigurations)
      .set({ enabled: true, updatedAt: new Date() })
      .where(eq(ssoConfigurations.id, config.id));

    // Audit log
    if (enabledBy) {
      await AuditLogger.logOrgManagement(
        "sso_configured",
        { actorId: enabledBy, organizationId },
        {
          previousValue: { enabled: false },
          newValue: { enabled: true },
        },
      );
    }
  }

  /**
   * Disable SSO for an organization
   */
  static async disable(organizationId: string, disabledBy?: string): Promise<void> {
    const config = await this.getConfig(organizationId);

    if (!config) {
      throw new Error("SSO not configured for this organization");
    }

    await db
      .update(ssoConfigurations)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(ssoConfigurations.id, config.id));

    // Audit log
    if (disabledBy) {
      await AuditLogger.logOrgManagement(
        "sso_configured",
        { actorId: disabledBy, organizationId },
        {
          previousValue: { enabled: true },
          newValue: { enabled: false },
        },
      );
    }
  }

  /**
   * Generate SAML Service Provider metadata
   */
  static generateSPMetadata(organizationId: string, baseUrl: string): string {
    const acsUrl = `${baseUrl}/api/auth/sso/saml/acs/${organizationId}`;
    const entityId = `${baseUrl}/api/auth/sso/saml/metadata/${organizationId}`;
    const sloUrl = `${baseUrl}/api/auth/sso/saml/slo/${organizationId}`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<md:EntityDescriptor xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${entityId}">
  <md:SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <md:NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</md:NameIDFormat>
    <md:AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${acsUrl}" index="0" isDefault="true"/>
    <md:SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect" Location="${sloUrl}"/>
  </md:SPSSODescriptor>
</md:EntityDescriptor>`;
  }

  /**
   * Process SSO authentication response
   */
  static async processAuthResponse(
    organizationId: string,
    userInfo: SSOUserInfo,
    sessionId: string,
  ): Promise<SSOAuthResult> {
    const config = await this.getConfig(organizationId);

    if (!config || !config.enabled) {
      return { success: false, error: "SSO not enabled for this organization" };
    }

    // Validate allowed domains if configured
    if (config.allowedDomains && config.allowedDomains.length > 0) {
      const emailDomain = userInfo.email.split("@")[1];
      if (!config.allowedDomains.includes(emailDomain)) {
        return { success: false, error: `Email domain ${emailDomain} is not allowed` };
      }
    }

    // Find or create user
    let user = await db.query.users.findFirst({
      where: eq(users.email, userInfo.email),
    });

    if (!user) {
      if (!config.autoProvision) {
        return { success: false, error: "User not found and auto-provisioning is disabled" };
      }

      // Create new user
      const [newUser] = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          email: userInfo.email,
          name: userInfo.name || `${userInfo.firstName || ""} ${userInfo.lastName || ""}`.trim() || userInfo.email,
          emailVerified: true, // SSO users are considered verified
        })
        .returning();

      user = newUser;

      // Add user to organization with default role
      await db.insert(members).values({
        id: crypto.randomUUID(),
        organizationId,
        userId: user.id,
        role: config.defaultRole,
        createdAt: new Date(),
      });

      // Audit log
      await AuditLogger.logOrgManagement(
        "member_added",
        { organizationId, actorType: "sso" },
        { targetUserId: user.id, targetEmail: user.email },
      );
    } else {
      // Check if user is member of organization
      const membership = await db.query.members.findFirst({
        where: eq(members.userId, user.id),
      });

      if (!membership) {
        if (!config.autoProvision) {
          return { success: false, error: "User is not a member of this organization" };
        }

        // Add user to organization
        await db.insert(members).values({
          id: crypto.randomUUID(),
          organizationId,
          userId: user.id,
          role: config.defaultRole,
          createdAt: new Date(),
        });

        await AuditLogger.logOrgManagement(
          "member_added",
          { organizationId, actorType: "sso" },
          { targetUserId: user.id, targetEmail: user.email },
        );
      }
    }

    // Create SSO session record
    const ssoSession: NewSSOSession = {
      id: crypto.randomUUID(),
      sessionId,
      ssoConfigId: config.id,
      externalUserId: userInfo.externalUserId,
      nameId: userInfo.email,
    };

    await db.insert(ssoSessions).values(ssoSession);

    // Audit log SSO login
    await AuditLogger.logAuth("sso_login", {
      actorId: user.id,
      actorEmail: user.email,
      actorType: "sso",
      organizationId,
    });

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      sessionId: ssoSession.id,
    };
  }

  /**
   * Validate SAML assertion (placeholder - real implementation needs saml library)
   */
  static async validateSAMLAssertion(
    organizationId: string,
    samlResponse: string,
  ): Promise<SSOUserInfo | null> {
    const config = await this.getConfig(organizationId);

    if (!config || config.providerType !== "saml") {
      return null;
    }

    // In a real implementation, you would use a SAML library like 'saml2-js' or '@node-saml/node-saml'
    // to parse and validate the SAML response against the IdP certificate

    // For this implementation, we provide the structure and interface
    // The actual SAML parsing would look like:
    // const saml2 = require('saml2-js');
    // const sp = new saml2.ServiceProvider({ ... });
    // const idp = new saml2.IdentityProvider({ sso_login_url: config.ssoUrl, certificates: [config.certificate] });
    // const parsed = await sp.post_assert(idp, { request_body: { SAMLResponse: samlResponse } });

    console.log("[SSO] SAML assertion validation - requires SAML library integration");

    // Placeholder return - actual implementation would parse the SAML response
    return null;
  }

  /**
   * Initiate OIDC authorization flow
   */
  static async initiateOIDCFlow(organizationId: string, redirectUri: string, state: string): Promise<string | null> {
    const config = await this.getConfig(organizationId);

    if (!config || config.providerType !== "oidc") {
      return null;
    }

    const params = new URLSearchParams({
      client_id: config.clientId || "",
      response_type: "code",
      scope: "openid profile email",
      redirect_uri: redirectUri,
      state,
    });

    // Use discovery URL or construct from issuer
    let authorizationEndpoint: string;
    if (config.discoveryUrl) {
      // In real implementation, fetch discovery document
      authorizationEndpoint = `${config.issuer}/authorize`;
    } else {
      authorizationEndpoint = `${config.issuer}/authorize`;
    }

    return `${authorizationEndpoint}?${params.toString()}`;
  }

  /**
   * Exchange OIDC authorization code for tokens
   */
  static async exchangeOIDCCode(
    organizationId: string,
    code: string,
    redirectUri: string,
  ): Promise<SSOUserInfo | null> {
    const config = await this.getConfig(organizationId);

    if (!config || config.providerType !== "oidc" || !config.clientId || !config.clientSecret) {
      return null;
    }

    // Token endpoint
    const tokenEndpoint = `${config.issuer}/token`;

    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });

      if (!response.ok) {
        console.error("[SSO] OIDC token exchange failed:", await response.text());
        return null;
      }

      const tokens = await response.json();

      // Fetch user info
      const userInfoEndpoint = `${config.issuer}/userinfo`;
      const userInfoResponse = await fetch(userInfoEndpoint, {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.error("[SSO] OIDC userinfo fetch failed:", await userInfoResponse.text());
        return null;
      }

      const userInfo = await userInfoResponse.json();

      // Map attributes
      const mapping = (config.attributeMapping as {
        email?: string;
        name?: string;
        firstName?: string;
        lastName?: string;
        groups?: string;
      }) || {};

      return {
        externalUserId: userInfo.sub,
        email: userInfo[mapping.email || "email"],
        name: userInfo[mapping.name || "name"],
        firstName: userInfo[mapping.firstName || "given_name"],
        lastName: userInfo[mapping.lastName || "family_name"],
        groups: userInfo[mapping.groups || "groups"],
      };
    } catch (error) {
      console.error("[SSO] OIDC exchange error:", error);
      return null;
    }
  }

  /**
   * Get SSO session by auth session ID
   */
  static async getSSOSession(authSessionId: string) {
    return db.query.ssoSessions.findFirst({
      where: eq(ssoSessions.sessionId, authSessionId),
      with: {
        ssoConfig: true,
      },
    });
  }

  /**
   * Delete SSO configuration
   */
  static async deleteConfig(organizationId: string, deletedBy?: string): Promise<void> {
    const config = await this.getConfig(organizationId);

    if (config) {
      await db.delete(ssoConfigurations).where(eq(ssoConfigurations.id, config.id));

      if (deletedBy) {
        await AuditLogger.logOrgManagement(
          "sso_configured",
          { actorId: deletedBy, organizationId },
          {
            previousValue: { enabled: config.enabled, providerType: config.providerType },
            newValue: { deleted: true },
          },
        );
      }
    }
  }

  /**
   * Test SSO configuration (dry run)
   */
  static async testConfig(organizationId: string): Promise<{ valid: boolean; errors: string[] }> {
    const config = await this.getConfig(organizationId);
    const errors: string[] = [];

    if (!config) {
      return { valid: false, errors: ["SSO not configured"] };
    }

    if (config.providerType === "saml") {
      if (!config.entityId) errors.push("Entity ID is required");
      if (!config.ssoUrl) errors.push("SSO URL is required");
      if (!config.certificate) errors.push("Certificate is required");

      // Validate certificate format
      if (config.certificate) {
        const certRegex = /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/;
        if (!certRegex.test(config.certificate)) {
          errors.push("Invalid certificate format");
        }
      }

      // Validate URL
      if (config.ssoUrl) {
        try {
          new URL(config.ssoUrl);
        } catch {
          errors.push("Invalid SSO URL format");
        }
      }
    } else {
      if (!config.issuer) errors.push("Issuer URL is required");
      if (!config.clientId) errors.push("Client ID is required");
      if (!config.clientSecret) errors.push("Client Secret is required");

      // Validate issuer URL
      if (config.issuer) {
        try {
          new URL(config.issuer);
        } catch {
          errors.push("Invalid issuer URL format");
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}

export default SSOService;
