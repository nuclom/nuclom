# Data Integrity Strategy

This document describes the data integrity measures implemented in Nuclom to ensure data consistency, security, and reliability.

## Overview

Data integrity in Nuclom is enforced at three layers:

1. **API Input Validation** - Effect Schema validates all incoming data
2. **Content Sanitization** - XSS prevention for user-generated content
3. **Database Constraints** - Foreign keys and cascade behaviors maintain referential integrity

## API Input Validation

### Effect Schema Library

All API endpoints validate input using Effect Schema definitions in `src/lib/validation/schemas.ts`.

**Key Schemas:**

| Schema | Endpoint | Purpose |
|--------|----------|---------|
| `createVideoSchema` | POST /api/videos | Video creation |
| `updateVideoSchema` | PATCH /api/videos/[id] | Video updates |
| `videoUploadSchema` | POST /api/videos/upload | Video file upload |
| `createSeriesSchema` | POST /api/series | Series creation |
| `createCommentSchema` | POST /api/videos/[id]/comments | Comment creation |
| `createOrganizationSchema` | POST /api/organizations | Organization creation |

### Validation Utilities

```typescript
import { validateRequestBody, validateQueryParams, validate } from "@/lib/validation";

// Validate JSON body
const data = yield* validateRequestBody(createVideoSchema, request);

// Validate query parameters
const params = yield* validateQueryParams(getVideosSchema, request.url);

// Validate any data
const result = yield* validate(someSchema, someData);
```

### Validation Features

- **Type Safety** - Full TypeScript inference from schemas
- **Error Messages** - Clear, user-friendly validation errors
- **Coercion** - Automatic type coercion for query parameters
- **Defaults** - Default values for optional fields
- **Constraints** - Min/max length, regex patterns, enums

## Content Sanitization

### XSS Prevention

All user-generated content is sanitized to prevent Cross-Site Scripting (XSS) attacks.

**Sanitization Functions:**

| Function | Use Case |
|----------|----------|
| `sanitizeTitle()` | Titles, names (strips HTML, no newlines) |
| `sanitizeDescription()` | Descriptions (strips HTML, preserves newlines) |
| `sanitizeComment()` | Comments (removes scripts, strips HTML) |
| `sanitizeCode()` | Code snippets (escapes HTML entities) |
| `sanitizeUrl()` | URLs (prevents javascript: protocol) |
| `sanitizeSlug()` | URL slugs (lowercase, alphanumeric, hyphens) |
| `sanitizeEmail()` | Email addresses (lowercase, trim) |

### Usage Example

```typescript
import { sanitizeTitle, sanitizeDescription, sanitizeComment } from "@/lib/validation";

// In API route
const sanitizedTitle = sanitizeTitle(validatedData.title);
const sanitizedDescription = sanitizeDescription(validatedData.description);
const sanitizedContent = sanitizeComment(validatedData.content);

// Store sanitized data
await videoRepo.createVideo({
  title: sanitizedTitle,
  description: sanitizedDescription,
  // ...
});
```

### What Gets Sanitized

- HTML tags are stripped from all content
- JavaScript URLs (javascript:, data:, vbscript:) are blocked
- Event handlers (onclick, onload, etc.) are removed
- Control characters are removed
- Whitespace is normalized

## File Upload Validation

### Magic Bytes Detection

File uploads are validated using magic bytes (file signatures) to prevent malicious files disguised as videos.

**Supported Video Formats:**
- MP4 (ftyp signatures)
- MOV (QuickTime)
- WebM/MKV (Matroska)
- AVI (RIFF)
- WMV (ASF)
- FLV (Flash)
- 3GP
- M4V

**Validation Process:**

1. Check file extension is allowed
2. Read first bytes of file (magic bytes)
3. Compare against known signatures for declared format
4. Reject if bytes don't match claimed format
5. Validate file size against limits

```typescript
import { validateVideoFile } from "@/lib/validation";

// In upload handler
yield* validateVideoFile({
  buffer: arrayBuffer,
  name: file.name,
  size: file.size,
});
```

### File Size Limits

| Content Type | Max Size |
|--------------|----------|
| Video | 500 MB |
| Image | 10 MB |
| Thumbnail | 5 MB |

## Database Constraints

### Foreign Key Behaviors

The schema defines appropriate ON DELETE behaviors for all foreign keys:

#### CASCADE DELETE

When parent is deleted, children are also deleted:

| Child Table | Parent | Behavior |
|-------------|--------|----------|
| sessions | users | CASCADE |
| accounts | users | CASCADE |
| members | users, organizations | CASCADE |
| invitations | organizations, users | CASCADE |
| apikeys | users | CASCADE |
| videos | organizations | CASCADE |
| channels | organizations | CASCADE |
| collections | organizations | CASCADE |
| comments | users, videos | CASCADE |
| videoProgresses | users, videos | CASCADE |
| seriesVideos | collections, videos | CASCADE |
| seriesProgress | users, collections | CASCADE |
| notifications | users | CASCADE |
| integrations | users, organizations | CASCADE |
| importedMeetings | integrations | CASCADE |
| subscriptions | organizations | CASCADE |
| usage | organizations | CASCADE |
| invoices | organizations | CASCADE |
| paymentMethods | organizations | CASCADE |

#### SET NULL

When parent is deleted, reference is cleared but child remains:

| Child Table | Column | Parent | Behavior |
|-------------|--------|--------|----------|
| videos | authorId | users | SET NULL |
| videos | channelId | channels | SET NULL |
| videos | collectionId | collections | SET NULL |
| collections | createdById | users | SET NULL |
| seriesProgress | lastVideoId | videos | SET NULL |
| notifications | actorId | users | SET NULL |
| importedMeetings | videoId | videos | SET NULL |

### Rationale

**CASCADE for:**
- User-specific data that has no value without the user (sessions, progress, preferences)
- Organization-specific data that belongs solely to that org (channels, content)
- Dependent data that can't exist without parent (comments need video, members need org)

**SET NULL for:**
- Content that should persist even if author leaves (videos, collections)
- Optional references that can be cleared (channel/collection assignments)
- Progress tracking that should survive video deletion (lastVideoId)

### Migration

The cascade constraints are enforced in migration `0003_fix_cascade_constraints.sql`:

```sql
-- Videos keep their content but clear author reference when user is deleted
ALTER TABLE "videos"
ADD CONSTRAINT "videos_author_id_users_id_fk"
FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
ON DELETE SET NULL ON UPDATE NO ACTION;
```

## Testing Cascade Deletes

Comprehensive tests verify cascade behavior in `src/lib/db/__tests__/cascade-delete.test.ts`:

```bash
# Run cascade delete tests
pnpm test src/lib/db/__tests__/cascade-delete.test.ts
```

### Test Categories

1. **Organization Deletion** - Verifies all org content is deleted
2. **User Deletion** - Verifies user data deleted, content preserved
3. **Video Deletion** - Verifies comments, progress deleted
4. **Channel/Collection Deletion** - Verifies SET NULL behavior

## Best Practices

### For API Development

1. Always use Effect Schema for input validation
2. Sanitize user content before storage
3. Use the validation utilities, don't validate manually
4. Return clear validation error messages

### For Database Operations

1. Never bypass foreign key constraints
2. Use transactions for multi-table operations
3. Consider cascade implications before deleting parents
4. Test cascade behavior with the provided tests

### For File Uploads

1. Always validate magic bytes, not just extension
2. Validate size before processing
3. Use streaming for large files
4. Store files in appropriate storage (R2)

## Error Handling

Validation errors are returned with clear messages:

```json
{
  "success": false,
  "error": "title: Title is required; organizationId: Invalid UUID format"
}
```

Effect-TS tagged errors provide type-safe error handling:

```typescript
// ValidationError for input validation failures
// MissingFieldError for required field missing
// These map to HTTP 400 responses
```

## Security Considerations

1. **Never trust client input** - Always validate server-side
2. **Defense in depth** - Validate at API + sanitize + DB constraints
3. **Fail closed** - Reject invalid input, don't try to fix it
4. **Log validation failures** - For security monitoring
5. **Rate limit** - Prevent validation-based DoS

## Related Documentation

- [Database Setup](./database-setup.md)
- [Migration Strategy](./migrations.md)
- [Database Architecture](../architecture/database.md)
