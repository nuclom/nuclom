# Authentication API

Nuclom uses Better Auth for comprehensive authentication with support for email/password and OAuth providers.

## Authentication Flow

The authentication system supports multiple flows:
1. Email/password registration and login
2. OAuth providers (GitHub, Google)
3. Session-based authentication
4. Password reset functionality

## Endpoints

### Authentication Handler

All authentication endpoints are handled through the Better Auth handler.

#### Endpoint
```
POST /api/auth/[...better-auth]
GET /api/auth/[...better-auth]
```

Better Auth automatically handles multiple authentication endpoints through dynamic routing.

## Common Authentication Endpoints

### Sign Up with Email/Password

```http
POST /api/auth/sign-up
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_12345",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    "session": {
      "sessionId": "session_67890",
      "expiresAt": "2024-01-08T00:00:00Z"
    }
  }
}
```

### Sign In with Email/Password

```http
POST /api/auth/sign-in
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_12345",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "session": {
      "sessionId": "session_67890",
      "expiresAt": "2024-01-08T00:00:00Z"
    }
  }
}
```

### Sign Out

```http
POST /api/auth/sign-out
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Signed out successfully"
  }
}
```

### Get Current Session

```http
GET /api/auth/session
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_12345",
      "email": "user@example.com",
      "name": "John Doe",
      "avatarUrl": "https://example.com/avatar.jpg"
    },
    "session": {
      "sessionId": "session_67890",
      "expiresAt": "2024-01-08T00:00:00Z"
    }
  }
}
```

## OAuth Authentication

### GitHub OAuth

```http
GET /api/auth/github
```

Redirects to GitHub OAuth authorization page.

**Callback URL:**
```
GET /api/auth/github/callback
```

### Google OAuth

```http
GET /api/auth/google
```

Redirects to Google OAuth authorization page.

**Callback URL:**
```
GET /api/auth/google/callback
```

## Password Reset

### Request Password Reset

```http
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset email sent"
  }
}
```

### Confirm Password Reset

```http
POST /api/auth/reset-password/confirm
Content-Type: application/json

{
  "token": "reset_token_123",
  "password": "newpassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

## Session Management

### Session Configuration

- **Session Duration**: 7 days
- **Session Update**: Every 24 hours
- **Session Storage**: Database-backed sessions
- **CSRF Protection**: Enabled

### Session Cookies

Better Auth automatically manages session cookies:
- `better-auth.session_token`: Session identifier
- `better-auth.csrf_token`: CSRF protection token

## Error Responses

### Authentication Errors

```json
{
  "success": false,
  "error": "Invalid credentials"
}
```

### Common Error Messages

- `"Invalid credentials"`: Wrong email/password combination
- `"User not found"`: Email not registered
- `"Email already exists"`: Email already registered
- `"Invalid token"`: Expired or invalid reset token
- `"Session expired"`: Session has expired
- `"CSRF token mismatch"`: CSRF validation failed

## Authentication Middleware

For protecting routes that require authentication, use the session validation:

```typescript
import { auth } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers
  });
  
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }
  
  return NextResponse.next();
}
```

## Client-Side Authentication

### React Integration

```typescript
import { useSession } from "@/hooks/useSession";

function AuthenticatedComponent() {
  const { user, session, loading } = useSession();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;
  
  return <div>Welcome, {user.name}!</div>;
}
```

### Sign In Form

```typescript
import { signIn } from "@/lib/auth-client";

async function handleSignIn(email: string, password: string) {
  try {
    const result = await signIn.email({
      email,
      password
    });
    
    if (result.success) {
      // Redirect to dashboard
      router.push("/dashboard");
    }
  } catch (error) {
    // Handle error
    console.error("Sign in error:", error);
  }
}
```

## Environment Variables

Required environment variables for authentication:

```env
# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here

# OAuth Providers
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/nuclom
```

## Security Best Practices

1. **Environment Variables**: Store sensitive credentials securely
2. **HTTPS**: Always use HTTPS in production
3. **Session Security**: Configure secure session cookies
4. **Password Policy**: Implement strong password requirements
5. **Rate Limiting**: Protect against brute force attacks
6. **Email Verification**: Enable email verification in production
7. **CSRF Protection**: Validate CSRF tokens on state-changing requests

## Testing Authentication

### Unit Tests

```typescript
import { auth } from "@/lib/auth";

describe("Authentication", () => {
  it("should create user session", async () => {
    const result = await auth.api.signInEmail({
      email: "test@example.com",
      password: "password123"
    });
    
    expect(result.user).toBeDefined();
    expect(result.session).toBeDefined();
  });
});
```

### Integration Tests

```typescript
import { POST } from "@/app/api/auth/sign-in/route";

describe("Sign In API", () => {
  it("should authenticate user", async () => {
    const request = new NextRequest("http://localhost/api/auth/sign-in", {
      method: "POST",
      body: JSON.stringify({
        email: "test@example.com",
        password: "password123"
      })
    });
    
    const response = await POST(request);
    const data = await response.json();
    
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.user).toBeDefined();
  });
});
```
