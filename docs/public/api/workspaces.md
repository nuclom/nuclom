# Workspaces API

The Workspaces API provides endpoints for managing team workspaces, user roles, and organizational structure for video collaboration.

## Endpoints

### List Workspaces

Retrieve workspaces for the authenticated user or all workspaces (admin only).

```http
GET /api/workspaces
```

**Query Parameters:**
- `userId` (string, optional): Filter by user ID to get user's workspaces

**Example Request:**
```http
GET /api/workspaces?userId=user_123
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ws_123",
      "name": "Development Team",
      "slug": "dev-team",
      "description": "Main development team workspace",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "users": [
        {
          "id": "wu_456",
          "userId": "user_123",
          "workspaceId": "ws_123",
          "role": "OWNER",
          "createdAt": "2024-01-01T00:00:00Z",
          "user": {
            "id": "user_123",
            "name": "John Doe",
            "email": "john@example.com",
            "avatarUrl": "https://example.com/avatar.jpg"
          }
        },
        {
          "id": "wu_789",
          "userId": "user_456",
          "workspaceId": "ws_123",
          "role": "MEMBER",
          "createdAt": "2024-01-01T00:00:00Z",
          "user": {
            "id": "user_456",
            "name": "Jane Smith",
            "email": "jane@example.com",
            "avatarUrl": "https://example.com/avatar2.jpg"
          }
        }
      ],
      "_count": {
        "videos": 25,
        "channels": 5,
        "series": 3
      }
    }
  ]
}
```

### Create Workspace

Create a new workspace for team collaboration.

```http
POST /api/workspaces
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Marketing Team",
  "slug": "marketing-team",
  "description": "Marketing team collaboration workspace",
  "ownerId": "user_123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ws_456",
    "name": "Marketing Team",
    "slug": "marketing-team",
    "description": "Marketing team collaboration workspace",
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "users": [
      {
        "id": "wu_101",
        "userId": "user_123",
        "workspaceId": "ws_456",
        "role": "OWNER",
        "createdAt": "2024-01-01T12:00:00Z",
        "user": {
          "id": "user_123",
          "name": "John Doe",
          "email": "john@example.com",
          "avatarUrl": "https://example.com/avatar.jpg"
        }
      }
    ]
  }
}
```

### Get Workspace

Retrieve a specific workspace with details.

```http
GET /api/workspaces/{id}
```

**Path Parameters:**
- `id` (string, required): Workspace ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ws_123",
    "name": "Development Team",
    "slug": "dev-team",
    "description": "Main development team workspace",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "users": [
      {
        "id": "wu_456",
        "userId": "user_123",
        "workspaceId": "ws_123",
        "role": "OWNER",
        "createdAt": "2024-01-01T00:00:00Z",
        "user": {
          "id": "user_123",
          "name": "John Doe",
          "email": "john@example.com",
          "avatarUrl": "https://example.com/avatar.jpg"
        }
      }
    ],
    "channels": [
      {
        "id": "ch_123",
        "name": "General",
        "description": "General team discussions",
        "workspaceId": "ws_123",
        "memberCount": 10,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "series": [
      {
        "id": "series_123",
        "name": "Onboarding",
        "description": "New team member onboarding videos",
        "workspaceId": "ws_123",
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-01T00:00:00Z"
      }
    ],
    "_count": {
      "videos": 25,
      "channels": 5,
      "series": 3
    }
  }
}
```

### Update Workspace

Update workspace information.

```http
PUT /api/workspaces/{id}
Content-Type: application/json
```

**Path Parameters:**
- `id` (string, required): Workspace ID

**Request Body:**
```json
{
  "name": "Updated Development Team",
  "description": "Updated description for the development team workspace"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ws_123",
    "name": "Updated Development Team",
    "slug": "dev-team",
    "description": "Updated description for the development team workspace",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T15:00:00Z"
  }
}
```

### Delete Workspace

Delete a workspace and all associated data.

```http
DELETE /api/workspaces/{id}
```

**Path Parameters:**
- `id` (string, required): Workspace ID

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Workspace deleted successfully"
  }
}
```

## User Management

### Add User to Workspace

```http
POST /api/workspaces/{id}/users
Content-Type: application/json
```

**Request Body:**
```json
{
  "userId": "user_789",
  "role": "MEMBER"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "wu_012",
    "userId": "user_789",
    "workspaceId": "ws_123",
    "role": "MEMBER",
    "createdAt": "2024-01-01T16:00:00Z",
    "user": {
      "id": "user_789",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "avatarUrl": "https://example.com/avatar3.jpg"
    }
  }
}
```

### Update User Role

```http
PUT /api/workspaces/{id}/users/{userId}
Content-Type: application/json
```

**Request Body:**
```json
{
  "role": "ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "wu_012",
    "userId": "user_789",
    "workspaceId": "ws_123",
    "role": "ADMIN",
    "createdAt": "2024-01-01T16:00:00Z",
    "user": {
      "id": "user_789",
      "name": "Alice Johnson",
      "email": "alice@example.com",
      "avatarUrl": "https://example.com/avatar3.jpg"
    }
  }
}
```

### Remove User from Workspace

```http
DELETE /api/workspaces/{id}/users/{userId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "User removed from workspace"
  }
}
```

## Channel Management

### List Channels

```http
GET /api/workspaces/{id}/channels
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ch_123",
      "name": "General",
      "description": "General team discussions",
      "workspaceId": "ws_123",
      "memberCount": 10,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Channel

```http
POST /api/workspaces/{id}/channels
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Development",
  "description": "Development team discussions and demos"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ch_456",
    "name": "Development",
    "description": "Development team discussions and demos",
    "workspaceId": "ws_123",
    "memberCount": 0,
    "createdAt": "2024-01-01T17:00:00Z",
    "updatedAt": "2024-01-01T17:00:00Z"
  }
}
```

### Update Channel

```http
PUT /api/workspaces/{id}/channels/{channelId}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Development",
  "description": "Updated channel description"
}
```

### Delete Channel

```http
DELETE /api/workspaces/{id}/channels/{channelId}
```

## Series Management

### List Series

```http
GET /api/workspaces/{id}/series
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "series_123",
      "name": "Onboarding",
      "description": "New team member onboarding videos",
      "workspaceId": "ws_123",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Series

```http
POST /api/workspaces/{id}/series
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Training Series",
  "description": "Comprehensive training videos for new features"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "series_456",
    "name": "Training Series",
    "description": "Comprehensive training videos for new features",
    "workspaceId": "ws_123",
    "createdAt": "2024-01-01T18:00:00Z",
    "updatedAt": "2024-01-01T18:00:00Z"
  }
}
```

### Update Series

```http
PUT /api/workspaces/{id}/series/{seriesId}
Content-Type: application/json
```

### Delete Series

```http
DELETE /api/workspaces/{id}/series/{seriesId}
```

## Data Models

### Workspace

```typescript
interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Workspace with Users

```typescript
interface WorkspaceWithUsers extends Workspace {
  users: WorkspaceUser[];
}
```

### WorkspaceUser

```typescript
interface WorkspaceUser {
  id: string;
  userId: string;
  workspaceId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  createdAt: string;
  user: User;
}
```

### Channel

```typescript
interface Channel {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  memberCount: number;
  createdAt: string;
  updatedAt: string;
}
```

### Series

```typescript
interface Series {
  id: string;
  name: string;
  description?: string;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}
```

## User Roles

### OWNER
- Full administrative access
- Can delete workspace
- Can manage all users and roles
- Can manage all content

### ADMIN
- Can manage users (except owners)
- Can manage channels and series
- Can manage workspace settings
- Can moderate content

### MEMBER
- Can view and create content
- Can comment on videos
- Can participate in discussions
- Cannot manage users or workspace settings

## Permissions

### Workspace Actions
- **Create**: Any authenticated user
- **View**: Workspace members only
- **Update**: Workspace OWNER/ADMIN
- **Delete**: Workspace OWNER only

### User Management
- **Add User**: Workspace OWNER/ADMIN
- **Remove User**: Workspace OWNER/ADMIN (cannot remove OWNER)
- **Update Role**: Workspace OWNER/ADMIN (cannot modify OWNER)

### Channel/Series Management
- **Create**: Workspace OWNER/ADMIN
- **Update**: Workspace OWNER/ADMIN
- **Delete**: Workspace OWNER/ADMIN

## Error Responses

### Workspace Not Found

```json
{
  "success": false,
  "error": "Workspace not found"
}
```

### Access Denied

```json
{
  "success": false,
  "error": "Access denied"
}
```

### Invalid Role

```json
{
  "success": false,
  "error": "Invalid role specified"
}
```

### Slug Already Exists

```json
{
  "success": false,
  "error": "Workspace slug already exists"
}
```

## Workspace Invitations

### Create Invitation

```http
POST /api/workspaces/{id}/invitations
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "role": "MEMBER"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "inv_123",
    "email": "newuser@example.com",
    "role": "MEMBER",
    "token": "invitation_token_abc123",
    "expiresAt": "2024-01-08T00:00:00Z",
    "createdAt": "2024-01-01T20:00:00Z"
  }
}
```

### Accept Invitation

```http
POST /api/workspaces/invitations/accept
Content-Type: application/json
```

**Request Body:**
```json
{
  "token": "invitation_token_abc123"
}
```

### List Invitations

```http
GET /api/workspaces/{id}/invitations
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "inv_123",
      "email": "newuser@example.com",
      "role": "MEMBER",
      "expiresAt": "2024-01-08T00:00:00Z",
      "createdAt": "2024-01-01T20:00:00Z",
      "accepted": false
    }
  ]
}
```

## Analytics

### Workspace Statistics

```http
GET /api/workspaces/{id}/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalVideos": 125,
    "totalUsers": 15,
    "totalChannels": 8,
    "totalSeries": 5,
    "totalViews": 1250,
    "totalComments": 89,
    "storageUsed": "2.4 GB",
    "activeUsers": 12
  }
}
```

### User Activity

```http
GET /api/workspaces/{id}/activity?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "activity_123",
      "type": "video_created",
      "userId": "user_123",
      "videoId": "video_456",
      "timestamp": "2024-01-01T21:00:00Z",
      "user": {
        "name": "John Doe",
        "avatarUrl": "https://example.com/avatar.jpg"
      }
    }
  ]
}
```

## Bulk Operations

### Bulk Add Users

```http
POST /api/workspaces/{id}/users/bulk
Content-Type: application/json
```

**Request Body:**
```json
{
  "users": [
    {
      "email": "user1@example.com",
      "role": "MEMBER"
    },
    {
      "email": "user2@example.com",
      "role": "MEMBER"
    }
  ]
}
```

### Bulk Update Roles

```http
PUT /api/workspaces/{id}/users/bulk
Content-Type: application/json
```

**Request Body:**
```json
{
  "updates": [
    {
      "userId": "user_123",
      "role": "ADMIN"
    },
    {
      "userId": "user_456",
      "role": "MEMBER"
    }
  ]
}
```

## Examples

### JavaScript/TypeScript

```typescript
// Create workspace
const workspace = await fetch('/api/workspaces', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'My Team',
    slug: 'my-team',
    description: 'Team workspace',
    ownerId: 'user_123'
  })
});

// Add user to workspace
await fetch(`/api/workspaces/${workspaceId}/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user_456',
    role: 'MEMBER'
  })
});
```

### React Hook

```typescript
import { useWorkspaces } from '@/hooks/useWorkspaces';

function WorkspaceList() {
  const { workspaces, loading, error } = useWorkspaces();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {workspaces.map(workspace => (
        <WorkspaceCard key={workspace.id} workspace={workspace} />
      ))}
    </div>
  );
}
```

## Rate Limits

- **Workspace Creation**: 5 per hour per user
- **User Invitations**: 50 per day per workspace
- **API Requests**: 100 per minute per user
