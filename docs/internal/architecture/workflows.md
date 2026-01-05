# Workflow Architecture

This document describes the durable workflow system in Nuclom, powered by Workflow DevKit (useworkflow.dev).

## Overview

Nuclom uses Workflow DevKit to add durability, reliability, and observability to long-running async operations. Workflows automatically handle retries, state persistence, and recovery without manual queue management.

## Benefits Over Fire-and-Forget

| Aspect | Fire-and-Forget | Workflow DevKit |
|--------|-----------------|-----------------|
| Retries | Manual implementation | Automatic with exponential backoff |
| Server Restart | Lost processing | Resume from last step |
| Observability | Manual logging | Built-in traces and metrics |
| Error Handling | Try-catch everywhere | FatalError vs RetryableError |
| Scheduling | External cron service | Native sleep() function |

## Available Workflows

### Video Processing (`src/workflows/video-processing.ts`)

Handles the complete AI analysis pipeline for videos.

```typescript
import { processVideoWorkflow } from "@/workflows/video-processing";

// Start the workflow
await processVideoWorkflow({
  videoId: "uuid",
  videoUrl: "https://r2.dev/...",
  videoTitle: "My Video",
});
```

**Steps:**
1. Update status to transcribing
2. Transcribe video using OpenAI Whisper
3. Save transcript to database
4. Update status to analyzing
5. Run AI analysis (summary, tags, action items, chapters, code snippets)
6. Save AI results
7. Update status to completed
8. Send notification

### Meeting Import (`src/workflows/import-meeting.ts`)

Imports recordings from Zoom and Google Meet.

```typescript
import { importMeetingWorkflow } from "@/workflows/import-meeting";

await importMeetingWorkflow({
  importedMeetingId: "uuid",
  integrationId: "uuid",
  provider: "zoom",
  externalId: "meeting-123",
  downloadUrl: "https://zoom.us/...",
  meetingTitle: "Team Standup",
  userId: "uuid",
  organizationId: "uuid",
  accessToken: "token",
});
```

**Steps:**
1. Update import status to downloading
2. Download recording from provider
3. Upload to Cloudflare R2
4. Create video record in database
5. Trigger video processing workflow
6. Update import status to completed

### Scheduled Cleanup (`src/workflows/scheduled-cleanup.ts`)

Automatically cleans up soft-deleted videos past retention period.

```typescript
import { scheduledCleanupWorkflow, runCleanupOnce } from "@/workflows/scheduled-cleanup";

// Start the continuous cleanup workflow (runs forever)
await scheduledCleanupWorkflow();

// Or run a single cleanup operation
const result = await runCleanupOnce();
console.log(`Deleted ${result.deletedCount} videos`);
```

**Features:**
- Uses `sleep("24 hours")` between runs
- Consumes no resources during sleep
- Survives server restarts

### Trial Reminders (`src/workflows/trial-reminders.ts`)

Sends reminder notifications before trial ends.

```typescript
import { trialReminderWorkflow } from "@/workflows/trial-reminders";

await trialReminderWorkflow({
  subscriptionId: "uuid",
  trialEndsAt: new Date("2024-02-01"),
});
```

**Reminder Schedule:**
- 7 days before trial ends
- 3 days before trial ends
- 1 day before trial ends

### Stripe Webhooks (`src/workflows/stripe-webhooks.ts`)

Durable handlers for Stripe webhook events.

```typescript
import {
  handleSubscriptionCreatedWorkflow,
  handleSubscriptionUpdatedWorkflow,
  handleSubscriptionDeletedWorkflow,
  handleInvoicePaidWorkflow,
  handleInvoiceFailedWorkflow,
  handleTrialEndingWorkflow,
} from "@/workflows/stripe-webhooks";

// Called from webhook handler
await handleSubscriptionCreatedWorkflow({
  eventId: event.id,
  eventType: event.type,
  data: { subscription, organizationId },
});
```

## Key Concepts

### `"use workflow"` Directive

Marks a function as a durable workflow:

```typescript
async function myWorkflow(input: Input): Promise<Output> {
  "use workflow";

  // Workflow code here
}
```

### `"use step"` Directive

Creates a checkpoint. If the workflow fails after this point, it will resume from the last checkpoint:

```typescript
async function myWorkflow(input: Input) {
  "use workflow";

  await step1();
  "use step";  // Checkpoint 1

  await step2();
  "use step";  // Checkpoint 2

  await step3();  // If this fails, workflow resumes from step2
}
```

### `sleep()` Function

Suspends the workflow without consuming resources:

```typescript
import { sleep } from "workflow";

async function scheduledTask() {
  "use workflow";

  while (true) {
    await doWork();
    await sleep("24 hours");  // No resources consumed during sleep
  }
}
```

### Error Handling

```typescript
import { FatalError } from "workflow";

async function myWorkflow() {
  "use workflow";

  try {
    await riskyOperation();
  } catch (error) {
    if (isUnrecoverable(error)) {
      // Stop retrying immediately
      throw new FatalError("Cannot recover from this error");
    }
    // Regular errors will be retried automatically
    throw error;
  }
}
```

## Configuration

### Next.js Integration

```typescript
// next.config.ts
import { withWorkflow } from "workflow/next";

export default withWorkflow(nextConfig);
```

### Package Version

```json
{
  "dependencies": {
    "workflow": "4.0.1-beta.39"
  }
}
```

## Best Practices

### 1. Keep Steps Small

Each step should be a discrete, atomic operation:

```typescript
// Good: Small, focused steps
await uploadFile();
"use step";
await updateDatabase();
"use step";
await sendNotification();

// Bad: Large step with multiple operations
await uploadFile();
await updateDatabase();
await sendNotification();
"use step";
```

### 2. Use FatalError for Unrecoverable Errors

```typescript
if (!apiKey) {
  throw new FatalError("API key not configured");
}
```

### 3. Handle Partial Failures

Design workflows to handle cases where some steps succeed and others fail:

```typescript
// Send notifications to multiple users
for (const user of users) {
  try {
    await sendEmail(user);
  } catch (error) {
    console.error(`Failed to send to ${user.email}:`, error);
    // Continue with other users
  }
}
"use step";
```

### 4. Use sleep() for Scheduling

Instead of external cron services, use the built-in sleep:

```typescript
async function dailyReport() {
  "use workflow";

  while (true) {
    await generateReport();
    await sleep("24 hours");
  }
}
```

## Observability

Workflow DevKit provides built-in observability:

- **Traces**: End-to-end execution traces
- **Logs**: Automatic logging of step execution
- **Metrics**: Duration, success/failure rates
- **Debug**: Inspect workflow state and history

## Migration from Fire-and-Forget

Before (fire-and-forget):
```typescript
// Old pattern
Effect.runPromise(aiEffect).catch((err) => {
  console.error("[AI Processing Error]", err);
});
```

After (durable workflow):
```typescript
// New pattern
processVideoWorkflow({
  videoId: data.videoId,
  videoUrl: data.videoUrl,
  videoTitle: data.videoTitle,
}).catch((err) => {
  console.error("[Video Processing Workflow Error]", err);
});
```

The workflow will automatically retry on failures and resume from the last checkpoint if the server restarts.

## Diarization Polling Improvement

Speaker diarization now uses the workflow `sleep()` function instead of `setTimeout` for polling AssemblyAI:

```typescript
// Before (fragile)
await new Promise((resolve) => setTimeout(resolve, 3000));

// After (durable)
await sleep("3 seconds");
```

This ensures that if the server restarts during diarization polling, the workflow resumes correctly.
