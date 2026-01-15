# Analytics & Feature Flags (PostHog)

This document describes the PostHog integration for analytics, feature flags, session recording, and error tracking in Nuclom.

## Overview

Nuclom uses [PostHog](https://posthog.com) for:

- **Product Analytics**: Track user behavior, page views, and custom events
- **Feature Flags**: Gradually roll out features and run A/B tests
- **Session Recording**: Record and replay user sessions for debugging
- **Error Tracking**: Capture and analyze JavaScript errors with source maps
- **Heatmaps**: Visualize user interactions on pages

## Architecture

### Client-Side (`posthog-js`)

The client-side SDK is initialized in the root layout via `PostHogProvider` and provides:

- Automatic pageview tracking (using `defaults: '2025-11-30'`)
- Autocapture for clicks, form submissions, and other interactions
- Feature flag evaluation with React hooks
- Session recording and heatmaps
- Error capture with stack traces

### Server-Side (`posthog-node`)

The server-side SDK enables:

- Server-side feature flag evaluation (no flicker)
- Event capture from API routes and background jobs
- User identification and property updates

## Setup

### Environment Variables

```bash
# Required for client and server
NEXT_PUBLIC_POSTHOG_KEY=phc_your-project-api-key
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com

# Optional: For source map uploads (error tracking)
POSTHOG_PERSONAL_API_KEY=phx_your-personal-api-key
POSTHOG_ENV_ID=production
```

### Getting API Keys

1. **Project API Key** (`NEXT_PUBLIC_POSTHOG_KEY`):
   - Go to PostHog > Project Settings > Project API Key
   - This is public and safe to expose client-side

2. **Personal API Key** (`POSTHOG_PERSONAL_API_KEY`):
   - Go to PostHog > Personal Settings > Personal API Keys
   - Create a key with "Source Maps" permission
   - Keep this secret (server-side only)

## Usage

### Client-Side Analytics

```tsx
'use client';

import { usePostHog, useFeatureFlagEnabled } from '@/lib/posthog';
import { useVideoAnalytics } from '@/lib/posthog/hooks';

function VideoPlayer({ videoId }: { videoId: string }) {
  const posthog = usePostHog();
  const { trackVideoView } = useVideoAnalytics();
  const hasNewPlayer = useFeatureFlagEnabled('new-video-player');

  useEffect(() => {
    trackVideoView(videoId, { source: 'embed' });
  }, [videoId]);

  // Custom event
  const handleShare = () => {
    posthog?.capture('video_shared', { videoId, method: 'link' });
  };

  return hasNewPlayer ? <NewPlayer /> : <OldPlayer />;
}
```

### Server-Side Analytics

```ts
import { captureServerEvent, isFeatureEnabled } from '@/lib/posthog/server';

export async function POST(request: Request) {
  const userId = 'user-123';

  // Check feature flag server-side (no flicker)
  const canUseNewFeature = await isFeatureEnabled(userId, 'new-feature');

  // Capture event from API route
  captureServerEvent(userId, 'api_video_upload', {
    fileSize: 1024000,
    format: 'mp4',
  });

  return Response.json({ success: true });
}
```

### Feature Flags

#### React Hook

```tsx
import { useFeatureFlag, FeatureFlags } from '@/lib/posthog/feature-flags';

function MyComponent() {
  const isEnabled = useFeatureFlag(FeatureFlags.NEW_DASHBOARD);

  if (isEnabled === undefined) return <Loading />;
  if (!isEnabled) return <OldDashboard />;
  return <NewDashboard />;
}
```

#### Feature Gate Component

```tsx
import { FeatureGate, FeatureFlags } from '@/lib/posthog/feature-flags';

function Page() {
  return (
    <FeatureGate
      flag={FeatureFlags.BETA_FEATURES}
      fallback={<StableVersion />}
      loading={<Skeleton />}
    >
      <BetaVersion />
    </FeatureGate>
  );
}
```

#### Server-Side Evaluation

```ts
import { isFeatureEnabled, getFeatureFlag } from '@/lib/posthog/server';

// Boolean check
const enabled = await isFeatureEnabled(userId, 'feature-key');

// Multivariate flag
const variant = await getFeatureFlag(userId, 'experiment-key');
// Returns: 'control' | 'variant-a' | 'variant-b' | true | false
```

### Analytics Hooks

Pre-built hooks for common tracking patterns:

```tsx
import {
  useVideoAnalytics,
  useCommentAnalytics,
  useClipAnalytics,
  useOrganizationAnalytics,
  useBillingAnalytics,
  useSearchAnalytics,
  useFeatureAnalytics,
  useAnalytics,
} from '@/lib/posthog/hooks';

// Video tracking
const { trackVideoUpload, trackVideoView, trackVideoShare } = useVideoAnalytics();

// Generic tracking
const { capture, identify, group, reset } = useAnalytics();
```

### User Identification

```tsx
import { useAnalytics } from '@/lib/posthog/hooks';

function useAuthEvents() {
  const { identify, reset, group } = useAnalytics();

  const onLogin = (user: User) => {
    // Identify user
    identify(user.id, {
      email: user.email,
      name: user.name,
      plan: user.plan,
    });

    // Associate with organization (group analytics)
    if (user.organizationId) {
      group('organization', user.organizationId, {
        name: user.organizationName,
        plan: user.organizationPlan,
      });
    }
  };

  const onLogout = () => {
    reset(); // Clear user identity
  };

  return { onLogin, onLogout };
}
```

## Event Naming Conventions

Use consistent event names from `AnalyticsEvents`:

| Event | Description |
|-------|-------------|
| `video_uploaded` | User uploads a video |
| `video_viewed` | User views a video |
| `video_shared` | User shares a video |
| `comment_added` | User adds a comment |
| `clip_created` | User creates a clip |
| `transcription_completed` | Transcription finishes |
| `organization_created` | New organization created |
| `user_invited` | User invites team member |
| `subscription_upgraded` | User upgrades plan |
| `feature_used` | User uses a feature |
| `search_performed` | User searches |

## Feature Flags Registry

Define all feature flags in `src/lib/posthog/feature-flags.ts`:

```ts
export const FeatureFlags = {
  // Video features
  VIDEO_AI_SUMMARY: 'video-ai-summary',
  VIDEO_CHAPTERS: 'video-chapters',

  // Beta features
  BETA_FEATURES: 'beta-features',
  EXPERIMENTAL_AI: 'experimental-ai',

  // Billing features
  NEW_PRICING: 'new-pricing',
} as const;
```

## Error Tracking

### Automatic Error Capture

Errors are automatically captured when `capture_exceptions: true` is set. PostHog wraps `window.onerror` and `window.onunhandledrejection`.

### Manual Error Capture

```tsx
import { usePostHog } from '@/lib/posthog';

function MyComponent() {
  const posthog = usePostHog();

  const handleError = (error: Error) => {
    posthog?.captureException(error, {
      extra: { context: 'video-upload' },
    });
  };
}
```

### Source Maps

Source maps are automatically uploaded during production builds when `POSTHOG_PERSONAL_API_KEY` is set. This enables readable stack traces in the PostHog error tracking dashboard.

Configuration in `next.config.ts`:

```ts
withPostHogConfig(config, {
  personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY,
  envId: process.env.POSTHOG_ENV_ID ?? 'default',
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  sourcemaps: {
    enabled: true,
    project: 'nuclom',
    version: process.env.VERCEL_GIT_COMMIT_SHA,
  },
});
```

## Session Recording

Session recording is enabled by default. Configure in PostHog dashboard:

1. Go to Settings > Session Recording
2. Configure sampling rate
3. Set up privacy controls (mask inputs, etc.)

### Privacy Controls

```ts
// In posthog init options
{
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: '.sensitive-data',
  }
}
```

## Best Practices

### Do

- Use predefined event names from `AnalyticsEvents`
- Track meaningful user actions, not every click
- Include relevant properties with events
- Use feature flags for gradual rollouts
- Identify users after authentication
- Group users by organization for B2B analytics

### Don't

- Track sensitive/PII data without consent
- Create too many custom events (use properties instead)
- Hardcode feature flag values
- Forget to flush events in serverless functions

## Debugging

### Development Mode

PostHog debug mode is enabled in development:

```ts
posthog.init(key, {
  debug: process.env.NODE_ENV === 'development',
});
```

Check browser console for PostHog logs.

### Feature Flag Overrides

In development, override flags via URL:

```
?posthog_feature_flags={"new-feature":true}
```

Or use PostHog toolbar (enable in project settings).

## Resources

- [PostHog Next.js Docs](https://posthog.com/docs/libraries/next-js)
- [Feature Flags Docs](https://posthog.com/docs/feature-flags)
- [Error Tracking Docs](https://posthog.com/docs/error-tracking)
- [Session Recording Docs](https://posthog.com/docs/session-replay)
