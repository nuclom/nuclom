# Integrations Architecture

This document describes the architecture of the Zoom and Google Meet integrations in Nuclom.

## Overview

Nuclom provides deep integrations with video conferencing platforms, allowing users to:
- Import meeting recordings from Zoom and Google Meet
- View calendar events with meeting links
- Auto-import recordings when meetings end
- Track import progress in real-time

## Architecture Components

### Service Layer

The integrations use Effect-TS for type-safe API operations.

```
src/lib/effect/services/
├── zoom.ts              # Zoom API operations (OAuth, recordings, users)
├── google-meet.ts       # Google API operations (OAuth, Drive, Calendar)
└── integration-repository.ts  # Database operations for integrations
```

### API Routes

```
src/app/api/integrations/
├── route.ts             # List/delete integrations
├── import/route.ts      # Import recordings
├── zoom/
│   ├── authorize/route.ts    # OAuth initiation
│   ├── callback/route.ts     # OAuth callback
│   ├── recordings/route.ts   # List recordings
│   ├── meetings/route.ts     # List scheduled meetings
│   └── webhook/route.ts      # Zoom webhook handler
├── google/
│   ├── authorize/route.ts    # OAuth initiation
│   ├── callback/route.ts     # OAuth callback
│   ├── recordings/route.ts   # List Drive recordings
│   ├── calendar/route.ts     # List calendar events
│   └── webhook/route.ts      # Google push notification handler
└── [integrationId]/
    └── settings/route.ts     # Integration settings management
```

### UI Components

```
src/components/integrations/
├── recording-browser.tsx       # Browse and select recordings to import
├── meeting-calendar.tsx        # Calendar view of meetings
├── import-progress-tracker.tsx # Real-time import status tracking
└── integration-settings.tsx    # Per-integration settings dialog
```

## Database Schema

### Integrations Table

Stores OAuth credentials and integration metadata:

```typescript
integrations {
  id: string (primary key)
  userId: string (FK to users)
  organizationId: string (FK to organizations)
  provider: "zoom" | "google_meet"
  accessToken: string
  refreshToken: string | null
  expiresAt: Date | null
  scope: string | null
  metadata: JSON {
    email?: string
    accountId?: string
    autoImport?: boolean
    notifyOnNewRecording?: boolean
    importMinDuration?: number
  }
  createdAt: Date
  updatedAt: Date
}
```

### Imported Meetings Table

Tracks imported recordings and their status:

```typescript
importedMeetings {
  id: string (primary key)
  integrationId: string (FK to integrations)
  videoId: string | null (FK to videos)
  externalId: string
  meetingTitle: string | null
  meetingDate: Date | null
  duration: number | null
  participants: JSON | null
  downloadUrl: string | null
  fileSize: number | null
  importStatus: "pending" | "downloading" | "processing" | "completed" | "failed"
  importError: string | null
  importedAt: Date | null
  createdAt: Date
}
```

## OAuth Flow

### Zoom OAuth

1. User clicks "Connect Zoom"
2. Backend generates state token and stores in HTTP-only cookie
3. Redirect to Zoom OAuth authorization URL
4. User authorizes on Zoom
5. Zoom redirects to callback URL with code
6. Backend exchanges code for tokens
7. Store tokens in database

### Google OAuth

Similar flow with additional:
- Requests `access_type=offline` for refresh tokens
- Uses `prompt=consent` to ensure refresh token is returned
- Scopes: `userinfo.email`, `userinfo.profile`, `drive.readonly`, `calendar.readonly`

## Recording Import Workflow

1. **Selection**: User browses recordings via provider API
2. **Initiation**: Selected recordings create `importedMeeting` records
3. **Download**: Background job downloads recording from provider
4. **Upload**: Video uploaded to Cloudflare R2
5. **Creation**: Video record created in database
6. **Processing**: AI analysis triggered (transcription, summary)
7. **Completion**: Status updated to "completed"

## Webhook Integration

### Zoom Webhooks

Endpoint: `/api/integrations/zoom/webhook`

Supported events:
- `recording.completed`: Auto-import new recordings
- `endpoint.url_validation`: Webhook URL verification

Security:
- HMAC-SHA256 signature verification
- Timestamp validation to prevent replay attacks

### Google Push Notifications

Endpoint: `/api/integrations/google/webhook`

Uses Google's push notification system for Drive/Calendar changes.
Channel tokens are used to identify the integration.

## Auto-Import Feature

When enabled via settings:
1. Webhook receives `recording.completed` event
2. Check if auto-import is enabled for the integration
3. Verify recording meets minimum duration requirement
4. Create import record and trigger workflow
5. User receives notification when complete

## Calendar Integration

Calendar view provides:
- Monthly calendar with meeting events
- Filter by provider (Zoom, Google Meet)
- Quick access to join links
- Direct link to browse related recordings

## Settings Management

Per-integration settings:
- **Auto-import**: Automatically import new recordings
- **Minimum duration**: Filter short recordings
- **Notifications**: Alert on new recordings

## Environment Variables

Required configuration:

```env
# Zoom Integration
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=
ZOOM_WEBHOOK_SECRET=

# Google Integration
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# App URL (for OAuth redirects)
NEXT_PUBLIC_URL=
```

## Error Handling

- Token expiration: Automatic refresh using refresh tokens
- Invalid tokens: Prompt user to reconnect
- Import failures: Status updated with error message, shown in UI
- Webhook failures: Logged for debugging, returned 5xx to trigger retry

## Security Considerations

1. **Token Storage**: Access tokens stored encrypted in database
2. **State Validation**: CSRF protection via state parameter
3. **Webhook Verification**: Signature validation for all webhook requests
4. **Scope Minimization**: Request only necessary OAuth scopes
5. **Token Refresh**: Auto-refresh to minimize user interruption

## Future Enhancements

- Microsoft Teams integration
- Slack integration for notifications
- Meeting scheduling from Nuclom
- Participant analytics
- Bulk import by date range
