# Analytics & Feature Flags (PostHog)

PostHog integration for analytics, feature flags, session recording, and error tracking.

## Overview

- **Product Analytics**: Track user behavior, page views, and custom events
- **Feature Flags**: Gradually roll out features and run A/B tests
- **Session Recording**: Record and replay user sessions for debugging
- **Error Tracking**: Capture JavaScript errors with source maps

## Setup

### Environment Variables

```bash
# Required
NEXT_PUBLIC_POSTHOG_KEY=phc_your-project-api-key
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# Optional: For source map uploads
POSTHOG_PERSONAL_API_KEY=phx_your-personal-api-key
POSTHOG_ENV_ID=production
```

### Getting API Keys

1. **Project API Key** (`NEXT_PUBLIC_POSTHOG_KEY`):
   - PostHog > Project Settings > Project API Key
   - Public, safe to expose client-side

2. **Personal API Key** (`POSTHOG_PERSONAL_API_KEY`):
   - PostHog > Personal Settings > Personal API Keys
   - Create with "Source Maps" permission
   - Keep secret (server-side only)

## Usage

### Client-Side

```tsx
'use client';

import { usePostHog, useFeatureFlagEnabled } from '@/lib/posthog';

function MyComponent() {
  const posthog = usePostHog();
  const isEnabled = useFeatureFlagEnabled('my-flag');

  const handleClick = () => {
    posthog?.capture('button_clicked', { button: 'signup' });
  };

  return <button onClick={handleClick}>Click</button>;
}
```

### Server-Side

```ts
import { captureServerEvent, isFeatureEnabled } from '@/lib/posthog/server';

export async function POST(request: Request) {
  const userId = 'user-123';

  // Check feature flag
  const enabled = await isFeatureEnabled(userId, 'my-flag');

  // Capture event
  captureServerEvent(userId, 'action_performed', { key: 'value' });

  return Response.json({ success: true });
}
```

### Feature Flags

```tsx
import { useFeatureFlag, FeatureGate } from '@/lib/posthog/feature-flags';

// Hook
function MyComponent() {
  const isEnabled = useFeatureFlag('my-flag');
  if (isEnabled === undefined) return <Loading />;
  return isEnabled ? <NewVersion /> : <OldVersion />;
}

// Component
function Page() {
  return (
    <FeatureGate flag="my-flag" fallback={<OldVersion />}>
      <NewVersion />
    </FeatureGate>
  );
}
```

### User Identification

```tsx
import { usePostHog } from '@/lib/posthog';

function useAuth() {
  const posthog = usePostHog();

  const onLogin = (user: User) => {
    posthog?.identify(user.id, { email: user.email });
    posthog?.group('organization', user.orgId);
  };

  const onLogout = () => {
    posthog?.reset();
  };
}
```

## Error Tracking

Errors are automatically captured. For manual capture:

```tsx
const posthog = usePostHog();
posthog?.captureException(error, { extra: { context: 'upload' } });
```

Source maps are uploaded during production builds when `POSTHOG_PERSONAL_API_KEY` is set.

## Resources

- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
- [Feature Flags Docs](https://posthog.com/docs/feature-flags)
- [Error Tracking Docs](https://posthog.com/docs/error-tracking)
