# Notifications API

The Notifications API provides endpoints for managing user notifications, including viewing, marking as read, and deleting notifications.

## Overview

Notifications are automatically created when:
- Someone replies to your comment
- Someone comments on your video
- You are @mentioned in a comment
- A video is shared with you

## Endpoints

### List Notifications

Retrieves all notifications for the authenticated user.

```
GET /api/notifications
Authorization: Bearer {token}
```

#### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number for pagination |
| `limit` | integer | 20 | Number of notifications per page |

#### Response

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": "notification-uuid",
        "userId": "user-uuid",
        "type": "comment_reply",
        "title": "New reply to your comment",
        "body": "John Doe replied to your comment",
        "resourceType": "video",
        "resourceId": "video-uuid",
        "actorId": "actor-user-uuid",
        "read": false,
        "createdAt": "2025-01-01T12:00:00Z",
        "actor": {
          "id": "actor-user-uuid",
          "name": "John Doe",
          "image": "https://example.com/avatar.jpg"
        }
      }
    ],
    "unreadCount": 5
  }
}
```

### Mark All as Read

Marks all notifications as read for the authenticated user.

```
POST /api/notifications
Authorization: Bearer {token}
```

#### Response

```json
{
  "success": true,
  "data": {
    "markedAsRead": 5
  }
}
```

### Mark Single as Read

Marks a specific notification as read.

```
PATCH /api/notifications/{notificationId}
Authorization: Bearer {token}
```

#### Response

```json
{
  "success": true,
  "data": {
    "id": "notification-uuid",
    "userId": "user-uuid",
    "type": "comment_reply",
    "title": "New reply to your comment",
    "body": "John Doe replied to your comment",
    "resourceType": "video",
    "resourceId": "video-uuid",
    "actorId": "actor-user-uuid",
    "read": true,
    "createdAt": "2025-01-01T12:00:00Z"
  }
}
```

### Delete Notification

Deletes a specific notification.

```
DELETE /api/notifications/{notificationId}
Authorization: Bearer {token}
```

#### Response

```json
{
  "success": true,
  "data": {
    "message": "Notification deleted successfully",
    "id": "notification-uuid"
  }
}
```

## Notification Types

| Type | Description |
|------|-------------|
| `comment_reply` | Someone replied to your comment |
| `comment_mention` | You were @mentioned in a comment |
| `new_comment_on_video` | Someone commented on your video |
| `video_shared` | A video was shared with you |

## Notification Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique notification identifier |
| `userId` | string | The user who receives the notification |
| `type` | string | Notification type (see types above) |
| `title` | string | Short notification title |
| `body` | string | Detailed notification message |
| `resourceType` | string | Type of related resource (e.g., "video", "comment") |
| `resourceId` | string | ID of the related resource |
| `actorId` | string | User who triggered the notification |
| `read` | boolean | Whether the notification has been read |
| `createdAt` | datetime | When the notification was created |
| `actor` | object | User object of the actor (optional) |

## Error Responses

### 401 Unauthorized

```json
{
  "success": false,
  "error": "Unauthorized"
}
```

### 404 Not Found

```json
{
  "success": false,
  "error": "Notification not found"
}
```

---

**See Also:**
- [Comments API](comments.md)
- [Collaboration Guide](../guides/collaboration.md)
