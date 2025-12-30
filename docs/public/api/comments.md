# Comments API

The Comments API enables real-time commenting functionality on videos, including threaded replies, timestamped comments, and real-time updates via Server-Sent Events (SSE).

## Overview

Comments are associated with videos and can be organized in threads. Each comment can optionally include a timestamp that links to a specific moment in the video.

## Endpoints

### List Comments for Video

Retrieves all comments for a specific video in a threaded format.

```
GET /api/videos/{videoId}/comments
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "comment-uuid",
      "content": "Great video!",
      "timestamp": "00:01:30",
      "authorId": "user-uuid",
      "videoId": "video-uuid",
      "parentId": null,
      "createdAt": "2025-01-01T12:00:00Z",
      "updatedAt": "2025-01-01T12:00:00Z",
      "author": {
        "id": "user-uuid",
        "name": "John Doe",
        "image": "https://example.com/avatar.jpg"
      },
      "replies": [
        {
          "id": "reply-uuid",
          "content": "Thanks!",
          "authorId": "user-uuid-2",
          "videoId": "video-uuid",
          "parentId": "comment-uuid",
          "createdAt": "2025-01-01T12:05:00Z",
          "updatedAt": "2025-01-01T12:05:00Z",
          "author": {
            "id": "user-uuid-2",
            "name": "Jane Smith",
            "image": "https://example.com/avatar2.jpg"
          },
          "replies": []
        }
      ]
    }
  ]
}
```

### Create Comment

Creates a new comment on a video. Requires authentication.

```
POST /api/videos/{videoId}/comments
Authorization: Bearer {token}
Content-Type: application/json
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The comment text |
| `timestamp` | string | No | Video timestamp (e.g., "00:01:30") |
| `parentId` | string | No | Parent comment ID for replies |

#### Example Request

```json
{
  "content": "Great explanation at this point!",
  "timestamp": "00:02:45",
  "parentId": null
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "new-comment-uuid",
    "content": "Great explanation at this point!",
    "timestamp": "00:02:45",
    "authorId": "user-uuid",
    "videoId": "video-uuid",
    "parentId": null,
    "createdAt": "2025-01-01T12:10:00Z",
    "updatedAt": "2025-01-01T12:10:00Z",
    "author": {
      "id": "user-uuid",
      "name": "John Doe",
      "image": "https://example.com/avatar.jpg"
    }
  }
}
```

### Get Single Comment

Retrieves a single comment by ID.

```
GET /api/comments/{commentId}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "comment-uuid",
    "content": "Great video!",
    "timestamp": "00:01:30",
    "authorId": "user-uuid",
    "videoId": "video-uuid",
    "parentId": null,
    "createdAt": "2025-01-01T12:00:00Z",
    "updatedAt": "2025-01-01T12:00:00Z",
    "author": {
      "id": "user-uuid",
      "name": "John Doe",
      "image": "https://example.com/avatar.jpg"
    }
  }
}
```

### Update Comment

Updates an existing comment. Only the comment author can edit.

```
PATCH /api/comments/{commentId}
Authorization: Bearer {token}
Content-Type: application/json
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `content` | string | Yes | The updated comment text |

#### Example Request

```json
{
  "content": "Updated comment content"
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "comment-uuid",
    "content": "Updated comment content",
    "timestamp": "00:01:30",
    "authorId": "user-uuid",
    "videoId": "video-uuid",
    "parentId": null,
    "createdAt": "2025-01-01T12:00:00Z",
    "updatedAt": "2025-01-01T12:15:00Z",
    "author": {
      "id": "user-uuid",
      "name": "John Doe",
      "image": "https://example.com/avatar.jpg"
    }
  }
}
```

### Delete Comment

Deletes a comment. Only the comment author or video owner can delete.

```
DELETE /api/comments/{commentId}
Authorization: Bearer {token}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Comment deleted successfully",
    "id": "comment-uuid"
  }
}
```

## Real-time Updates

### Comment Stream (SSE)

Subscribe to real-time comment updates for a video using Server-Sent Events.

```
GET /api/videos/{videoId}/comments/stream
```

#### Event Types

| Event | Description |
|-------|-------------|
| `connected` | Sent when connection is established |
| `comment` | Sent when a comment is created, updated, or deleted |

#### Event Format

```
event: connected
data: {"videoId": "video-uuid"}

event: comment
data: {"type": "created", "comment": {...}, "videoId": "video-uuid"}
```

#### Comment Event Types

| Type | Description |
|------|-------------|
| `created` | New comment was added |
| `updated` | Existing comment was modified |
| `deleted` | Comment was removed |

#### Example Client Usage

```typescript
const eventSource = new EventSource('/api/videos/{videoId}/comments/stream');

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

eventSource.onerror = () => {
  console.log('Connection lost, reconnecting...');
};
```

## Error Responses

### 400 Bad Request

```json
{
  "success": false,
  "error": "Comment content is required"
}
```

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 403 Forbidden

```json
{
  "success": false,
  "error": "You can only edit your own comments"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Comment not found"
}
```

---

**See Also:**
- [Videos API](videos.md)
- [Notifications API](notifications.md)
- [Collaboration Guide](../guides/collaboration.md)
