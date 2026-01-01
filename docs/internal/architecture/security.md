# Security Architecture

This document describes the security features and best practices implemented in the Nuclom platform.

## Rate Limiting

The platform implements comprehensive rate limiting to protect against abuse:

### Configuration

Rate limits are configured in `src/lib/rate-limit.ts` and applied via Next.js middleware (`src/middleware.ts`).

| Endpoint Type | Requests | Window | Use Case |
|---------------|----------|--------|----------|
| General API | 100 | 1 minute | Standard API endpoints |
| Authentication | 10 | 15 minutes | Login, signup, sign-out |
| Sensitive Operations | 5 | 1 hour | Password reset, account deletion |
| File Uploads | 20 | 1 hour | Video and file uploads |

### Response Headers

All API responses include rate limit information:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets

When rate limited, endpoints return HTTP 429 with a `Retry-After` header.

### Usage

```typescript
import { rateLimit, rateLimitAuth } from "@/lib/rate-limit";

// In API routes
export async function POST(request: NextRequest) {
  const rateLimitResult = rateLimitAuth(request);
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

### Session Fingerprinting

Sessions are bound to the client's IP address and user agent to detect session hijacking:

```typescript
// Fingerprint is generated on session creation
const fingerprint = await generateFingerprint(ipAddress, userAgent);
```

The fingerprint is stored in the database and validated periodically.

### Concurrent Session Limits

Users are limited to a maximum number of concurrent sessions (default: 5). When a new session is created, the oldest sessions are automatically revoked if the limit is exceeded.

```typescript
// Default limit, can be customized per user
const DEFAULT_MAX_SESSIONS = 5;
```

### Session Revocation on Password Change

When a user changes their password, all sessions created before the password change are automatically revoked:

```typescript
// Revoke sessions created before password change
await revokeSessionsBeforeDate(userId, passwordChangedAt, currentSessionId);
```

### Secure Cookie Settings

Session cookies are configured with secure settings:

```typescript
{
  httpOnly: true,           // Prevents JavaScript access
  secure: true,             // HTTPS only in production
  sameSite: "lax",          // CSRF protection
  path: "/",
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
GET  /api/user/sessions         - List all active sessions
DELETE /api/user/sessions       - Revoke all sessions except current
DELETE /api/user/sessions/:id   - Revoke a specific session
POST /api/user/password         - Handle session revocation on password change
```

## Database Schema

The following columns support session security:

### Users Table
- `passwordChangedAt` - Timestamp of last password change
- `maxSessions` - Custom session limit for the user (null = default)

### Sessions Table
- `fingerprint` - SHA-256 hash of IP + user agent
- `lastFingerprintCheck` - Timestamp of last fingerprint validation

## Best Practices

1. **Always use HTTPS in production** - The `secure` cookie flag enforces this
2. **Monitor rate limit violations** - Potential abuse indicator
3. **Review session activity** - Users can view and revoke sessions in settings
4. **Rotate secrets regularly** - Update `BETTER_AUTH_SECRET` periodically
5. **Keep dependencies updated** - Security patches for auth libraries

## Related Files

- `src/lib/rate-limit.ts` - Rate limiting implementation
- `src/lib/session-security.ts` - Session security utilities
- `src/lib/auth.ts` - Authentication configuration
- `src/middleware.ts` - Next.js middleware for rate limiting
- `next.config.ts` - Security headers configuration
- `src/app/api/user/sessions/` - Session management API
