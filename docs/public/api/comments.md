# Comments API

The Comments API enables real-time commenting on videos, including threaded replies, timestamped comments, reactions, and live updates via Server-Sent Events.

> **Note**: For complete endpoint documentation including request/response schemas, see the [OpenAPI specification](/openapi.json) or the [Interactive API Reference](/docs/api/reference).

## Overview

Comments are associated with videos and can be organized in threads. Each comment can optionally include a timestamp that links to a specific moment in the video.

## Key Features

- **Timestamped Comments**: Link comments to specific moments in videos
- **Threaded Replies**: Nested conversations with parent/child relationships
- **Reactions**: 8 reaction types for quick feedback
- **Real-time Updates**: Server-sent events for live comment streams
- **Mentions**: Tag users with @mentions

## API Endpoints

### Comment Operations

| Endpoint | Description |
|----------|-------------|
| `GET /videos/{id}/comments` | List comments for a video |
| `POST /videos/{id}/comments` | Create a comment |
| `GET /comments/{id}` | Get a single comment with replies |
| `PATCH /comments/{id}` | Update comment content |
| `DELETE /comments/{id}` | Delete a comment |

### Reactions

| Endpoint | Description |
|----------|-------------|
| `POST /comments/{id}/reactions` | Add reaction to comment |
| `GET /comments/{id}/reactions` | List reactions on a comment |
| `DELETE /comments/{id}/reactions` | Remove your reaction |

### Real-time

| Endpoint | Description |
|----------|-------------|
| `GET /videos/{id}/comments/stream` | Server-sent events stream |

## Data Models

### Comment

```typescript
interface Comment {
  id: string;
  content: string;
  timestamp?: string;      // "HH:MM:SS" format
  authorId: string;
  videoId: string;
  parentId?: string;       // Parent comment ID for replies
  author?: User;
  replies?: Comment[];
  reactions?: Reaction[];
  createdAt: string;
  updatedAt: string;
}
```

### Reaction

```typescript
interface Reaction {
  id: string;
  type: "like" | "love" | "laugh" | "wow" | "sad" | "angry" | "thinking" | "custom";
  customEmoji?: string;
  userId: string;
  commentId: string;
  createdAt: string;
}
```

## Real-time Updates

Subscribe to comment updates using Server-Sent Events:

```typescript
const eventSource = new EventSource(`/api/videos/${videoId}/comments/stream`);

eventSource.addEventListener('connected', (e) => {
  console.log('Connected to comment stream');
});

eventSource.addEventListener('comment', (e) => {
  const event = JSON.parse(e.data);
  switch (event.type) {
    case 'created':
      // Add new comment to UI
      break;
    case 'updated':
      // Update comment in UI
      break;
    case 'deleted':
      // Remove comment from UI
      break;
  }
});
```

### Event Types

| Event | Description |
|-------|-------------|
| `connected` | Connection established |
| `created` | New comment added |
| `updated` | Comment modified |
| `deleted` | Comment removed |

## Permissions

| Action | Required Permission |
|--------|---------------------|
| View comments | Organization member |
| Create comment | Organization member |
| Update comment | Comment author only |
| Delete comment | Comment author or video owner |
| Add reaction | Organization member |

## Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND_COMMENT` | Comment not found |
| `VALIDATION_MISSING_FIELD` | Content is required |
| `AUTH_FORBIDDEN` | Cannot modify others' comments |

## Content Moderation

Comments are sanitized to prevent XSS attacks. HTML tags, script content, and event handlers are stripped.

---

**See Also:**
- [Videos API](videos.md)
- [Notifications API](notifications.md)
