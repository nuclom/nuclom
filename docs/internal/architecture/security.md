# Security Architecture

This document describes the security features and best practices implemented in the Nuclom platform.

## Rate Limiting

The platform implements comprehensive rate limiting to protect against abuse:

### Storage Backend

Rate limiting supports two storage backends:

1. **Redis (Upstash)** - Recommended for production
   - Distributed rate limiting across all server instances
   - Persistent across deployments
   - Uses Upstash's sliding window algorithm
   - Requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables

2. **In-Memory** - Fallback for development
   - Per-instance rate limiting
   - Used automatically when Redis is not configured
   - State lost on restart

### Configuration

Rate limits are configured in `src/lib/rate-limit.ts` and applied via Next.js middleware (`src/middleware.ts`).

| Endpoint Type | Requests | Window | Use Case |
|---------------|----------|--------|----------|
| General API | 100 | 1 minute | Standard API endpoints |
| Authentication | 10 | 15 minutes | Login, signup, sign-out |
| Sensitive Operations | 5 | 1 hour | Password reset, account deletion |
| File Uploads | 20 | 1 hour | Video and file uploads |

### Environment Variables

```bash
# Upstash Redis (get these from your Vercel/Upstash dashboard)
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

### Response Headers

All API responses include rate limit information:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

When rate limited, endpoints return HTTP 429 with a `Retry-After` header.

### Usage

```typescript
// Sync version (for middleware, uses in-memory)
import { rateLimit, rateLimitAuth } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimitAuth(request);
  if (rateLimitResult) return rateLimitResult;
  // ... handle request
}

// Async version (for API routes, uses Redis when available)
import { rateLimitAsync, rateLimitAuthAsync } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rateLimitResult = await rateLimitAuthAsync(request);
  if (rateLimitResult) return rateLimitResult;
  // ... handle request
}
```

## Security Headers

Security headers are configured in `next.config.ts` and applied to all routes:

| Header | Value | Purpose |
|--------|-------|---------|
| Content-Security-Policy | Strict CSP | Prevents XSS and injection attacks |
| X-Frame-Options | SAMEORIGIN | Prevents clickjacking |
| X-Content-Type-Options | nosniff | Prevents MIME type sniffing |
| Referrer-Policy | strict-origin-when-cross-origin | Controls referrer information |
| Permissions-Policy | Restrictive policy | Limits browser features |
| X-XSS-Protection | 1; mode=block | XSS protection for older browsers |

### Content Security Policy

The CSP is configured to:
- Allow scripts from self only (with unsafe-inline for Next.js)
- Allow styles from self and inline (for CSS-in-JS)
- Allow images from trusted domains (GitHub, Google, Gravatar, Cloudflare R2)
- Allow connections to self, Stripe, and R2 storage
- Prevent embedding in iframes (except same-origin)
- Upgrade insecure requests in production

## Session Security

Session security is handled by better-auth's built-in features and plugins.

### Session Tracking

Sessions automatically track IP address and user agent for each session, which can be viewed by users in their account settings.

### Concurrent Session Limits

The `multiSession` plugin limits users to a maximum of 5 concurrent sessions. When a new session is created and the limit is exceeded, the oldest sessions are automatically revoked.

```typescript
// Configured in auth.ts
multiSession({
  maximumSessions: 5,
});
```

### Session Revocation on Password Change

Use better-auth's built-in `changePassword` function with the `revokeOtherSessions` option:

```typescript
// Client-side usage
await authClient.changePassword({
  currentPassword: "...",
  newPassword: "...",
  revokeOtherSessions: true, // Revokes all other sessions
});
```

### Secure Cookie Settings

Session cookies are configured with secure settings in better-auth's `advanced` configuration:

```typescript
advanced: {
  cookiePrefix: "nuclom",
  useSecureCookies: env.NODE_ENV === "production",
  defaultCookieAttributes: {
    httpOnly: true,           // Prevents JavaScript access
    secure: true,             // HTTPS only in production
    sameSite: "lax",          // CSRF protection
    path: "/",
  },
}
```

## CORS Configuration

CORS is strictly configured in `src/lib/auth.ts`:

- Production: Only the main app URL is trusted
- Preview deployments: Vercel preview URLs are allowed (non-production only)
- Development: localhost is allowed

```typescript
// Trusted origins are built dynamically based on environment
const trustedOrigins = buildTrustedOrigins();
```

## API Endpoints

### Session Management

```
GET    /api/user/sessions       - List all active sessions
DELETE /api/user/sessions       - Revoke all sessions except current
```

Password changes with session revocation are handled via better-auth's `/api/auth/change-password` endpoint.

## Database Schema

The following columns support session security:

### Sessions Table (managed by better-auth)
- `ipAddress` - IP address of the session
- `userAgent` - User agent string of the session
- `expiresAt` - Session expiration timestamp
- `createdAt` - Session creation timestamp

## Best Practices

1. **Always use HTTPS in production** - The `secure` cookie flag enforces this
2. **Monitor rate limit violations** - Potential abuse indicator
3. **Review session activity** - Users can view and revoke sessions in settings
4. **Rotate secrets regularly** - Update `BETTER_AUTH_SECRET` periodically
5. **Keep dependencies updated** - Security patches for auth libraries

## Enterprise Security Features

### SSO/SAML Integration

Enterprise organizations can configure Single Sign-On using SAML 2.0 or OIDC protocols.

#### Configuration

```typescript
// SAML Configuration
{
  providerType: "saml",
  entityId: "https://idp.example.com/entity",
  ssoUrl: "https://idp.example.com/sso",
  sloUrl: "https://idp.example.com/slo",
  certificate: "-----BEGIN CERTIFICATE-----...",
  autoProvision: true,
  defaultRole: "member",
  allowedDomains: ["example.com"]
}

// OIDC Configuration
{
  providerType: "oidc",
  issuer: "https://auth.example.com",
  clientId: "your-client-id",
  clientSecret: "your-client-secret",
  discoveryUrl: "https://auth.example.com/.well-known/openid-configuration"
}
```

#### API Endpoints

```
GET    /api/organizations/:id/sso     - Get SSO configuration
POST   /api/organizations/:id/sso     - Configure SSO
PATCH  /api/organizations/:id/sso     - Enable/disable SSO
DELETE /api/organizations/:id/sso     - Delete SSO configuration
```

### Advanced RBAC (Role-Based Access Control)

Granular permission system supporting custom roles and resource-level permissions.

#### Permission Model

- **Resources**: video, channel, collection, comment, member, settings, billing, analytics, integration, audit_log
- **Actions**: create, read, update, delete, share, comment, download, manage, invite, admin

#### System Roles

| Role | Description | Key Permissions |
|------|-------------|-----------------|
| Owner | Full control | All permissions including billing |
| Admin | Administrative access | All except billing admin |
| Editor | Content management | Create, edit, share content |
| Viewer | Read-only access | View content, add comments |

#### API Endpoints

```
GET    /api/organizations/:id/roles              - List all roles
POST   /api/organizations/:id/roles              - Create custom role
GET    /api/organizations/:id/roles/:roleId      - Get role details
PATCH  /api/organizations/:id/roles/:roleId      - Update role
DELETE /api/organizations/:id/roles/:roleId      - Delete role
GET    /api/organizations/:id/members/:userId/permissions - Get user permissions
POST   /api/organizations/:id/members/:userId/permissions - Assign role
DELETE /api/organizations/:id/members/:userId/permissions - Remove role
```

### Comprehensive Audit Logging

All security-relevant actions are logged for compliance and forensics.

#### Log Categories

- `authentication` - Login, logout, password changes, 2FA events
- `authorization` - Permission grants, role assignments
- `user_management` - User creation, updates, deletion
- `organization_management` - Member changes, settings updates
- `content_management` - Video/channel/collection CRUD operations
- `billing` - Subscription and payment events
- `security` - Session revocation, suspicious activity
- `integration` - Third-party service connections
- `system` - System-level events

#### Log Severity Levels

- `info` - Normal operations
- `warning` - Potential issues (failed logins, rate limits)
- `error` - Operation failures
- `critical` - Security incidents requiring immediate attention

#### API Endpoints

```
GET  /api/organizations/:id/audit-logs                    - Query audit logs
POST /api/organizations/:id/audit-logs                    - Request export
GET  /api/organizations/:id/audit-logs/stats              - Get statistics
GET  /api/organizations/:id/audit-logs/exports/:exportId  - Check export status
```

#### Export Formats

- **CSV** - For spreadsheet analysis
- **JSON** - For programmatic processing

## Related Files

- `src/lib/rate-limit.ts` - Rate limiting implementation (Redis + in-memory)
- `src/lib/redis.ts` - Redis client configuration (Upstash)
- `src/lib/auth.ts` - Authentication and session configuration (better-auth)
- `src/lib/access-control.ts` - Better Auth access control (RBAC) configuration
- `src/lib/audit-log.ts` - Audit logging service
- `src/middleware.ts` - Next.js middleware for rate limiting
- `next.config.ts` - Security headers configuration
- `src/app/api/user/sessions/` - Session management API
- `src/app/api/organizations/[id]/sso/` - SSO configuration API
- `src/app/api/organizations/[id]/roles/` - RBAC roles API
- `src/app/api/organizations/[id]/audit-logs/` - Audit logs API
