# Authentication Setup

The Nuclom application uses [BetterAuth](https://better-auth.com/) for authentication and user management.

## Features

- ✅ Email/Password Authentication
- ✅ OAuth Integration (GitHub, Google)
- ✅ Session Management (7-day expiry)
- ✅ User Profile Management
- ✅ Route Protection
- ✅ Loading States
- ✅ Error Handling

## Quick Setup

1. **Install Dependencies** (already included)

   ```bash
   npm install better-auth
   ```

2. **Set Environment Variables**

   ```bash
   cp .env.example .env.local
   # Fill in the required values
   ```

3. **Database Setup**

   - Better Auth automatically creates the required tables
   - Ensure your PostgreSQL database is running
   - Set `DATABASE_URL` in your environment

4. **OAuth Setup** (Optional)
   - Create GitHub OAuth App
   - Create Google OAuth App
   - Add credentials to environment

## Usage

### Authentication Hooks

```tsx
import { useAuth } from "@/hooks/use-auth";

function MyComponent() {
  const { user, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!user) return <div>Please sign in</div>;

  return <div>Hello {user.name}!</div>;
}
```

### Route Protection

```tsx
import { RequireAuth } from "@/components/auth/auth-guard";

function ProtectedPage() {
  return (
    <RequireAuth>
      <div>This content requires authentication</div>
    </RequireAuth>
  );
}
```

### Authentication Pages

- `/login` - Sign in page
- `/register` - Sign up page
- Both support `?redirectTo=` parameter for post-auth redirects

## Available Routes

- **Public Routes**: `/login`, `/register`
- **Protected Routes**: All organization routes (handled by client-side auth)

## Database Schema

Better Auth automatically manages these tables:

- `user` - User accounts
- `session` - User sessions
- `account` - OAuth account linking
- `verification` - Email verification tokens

## Production Considerations

1. **Set Strong Secret**

   ```bash
   BETTER_AUTH_SECRET=$(openssl rand -base64 32)
   ```

2. **Enable Email Verification**

   ```ts
   // In src/lib/auth.ts
   emailAndPassword: {
     enabled: true,
     requireEmailVerification: true, // Set to true
   }
   ```

3. **Configure CORS** for your domain

4. **Set up Email Provider** for verification emails

## Troubleshooting

- **"Default secret" warning**: Set `BETTER_AUTH_SECRET` environment variable
- **OAuth not working**: Check client IDs and secrets are set correctly
- **Database errors**: Ensure PostgreSQL is running and `DATABASE_URL` is correct
