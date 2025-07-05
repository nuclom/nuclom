# Organizations API

The Organizations API provides endpoints for managing team organizations, user roles, and organizational structure for video collaboration.

## Endpoints

### List Organizations

Retrieve organizations for the authenticated user or all organizations (admin only).

```http
GET /api/organizations
```

**Query Parameters:**

- `userId` (string, optional): Filter by user ID to get user's organizations

**Example Request:**

```http
GET /api/organizations?userId=user_123
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
      "description": "Main development team organization",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z",
      "users": [
        {
          "id": "wu_456",
          "userId": "user_123",
          "organizationId": "ws_123",
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
          "organizationId": "ws_123",
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

### Create Organization

Create a new organization for team collaboration.

```http
POST /api/organizations
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Marketing Team",
  "slug": "marketing-team",
  "description": "Marketing team collaboration organization",
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
    "description": "Marketing team collaboration organization",
    "createdAt": "2024-01-01T12:00:00Z",
    "updatedAt": "2024-01-01T12:00:00Z",
    "users": [
      {
        "id": "wu_101",
        "userId": "user_123",
        "organizationId": "ws_456",
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

### Get Organization

Retrieve a specific organization with details.

```http
GET /api/organizations/{id}
```

**Path Parameters:**

- `id` (string, required): Organization ID

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "ws_123",
    "name": "Development Team",
    "slug": "dev-team",
    "description": "Main development team organization",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T00:00:00Z",
    "users": [
      {
        "id": "wu_456",
        "userId": "user_123",
        "organizationId": "ws_123",
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
        "organizationId": "ws_123",
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
        "organizationId": "ws_123",
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

### Update Organization

Update organization information.

```http
PUT /api/organizations/{id}
Content-Type: application/json
```

**Path Parameters:**

- `id` (string, required): Organization ID

**Request Body:**

```json
{
  "name": "Updated Development Team",
  "description": "Updated description for the development team organization"
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
    "description": "Updated description for the development team organization",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-01T15:00:00Z"
  }
}
```

### Delete Organization

Delete a organization and all associated data.

```http
DELETE /api/organizations/{id}
```

**Path Parameters:**

- `id` (string, required): Organization ID

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "Organization deleted successfully"
  }
}
```

## User Management

### Add User to Organization

```http
POST /api/organizations/{id}/users
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
    "organizationId": "ws_123",
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
PUT /api/organizations/{id}/users/{userId}
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
    "organizationId": "ws_123",
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

### Remove User from Organization

```http
DELETE /api/organizations/{id}/users/{userId}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "message": "User removed from organization"
  }
}
```

## Channel Management

### List Channels

```http
GET /api/organizations/{id}/channels
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
      "organizationId": "ws_123",
      "memberCount": 10,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Channel

```http
POST /api/organizations/{id}/channels
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
    "organizationId": "ws_123",
    "memberCount": 0,
    "createdAt": "2024-01-01T17:00:00Z",
    "updatedAt": "2024-01-01T17:00:00Z"
  }
}
```

### Update Channel

```http
PUT /api/organizations/{id}/channels/{channelId}
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
DELETE /api/organizations/{id}/channels/{channelId}
```

## Series Management

### List Series

```http
GET /api/organizations/{id}/series
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
      "organizationId": "ws_123",
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### Create Series

```http
POST /api/organizations/{id}/series
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
    "organizationId": "ws_123",
    "createdAt": "2024-01-01T18:00:00Z",
    "updatedAt": "2024-01-01T18:00:00Z"
  }
}
```

### Update Series

```http
PUT /api/organizations/{id}/series/{seriesId}
Content-Type: application/json
```

### Delete Series

```http
DELETE /api/organizations/{id}/series/{seriesId}
```

## Data Models

### Organization

```typescript
interface Organization {
  id: string;
  name: string;
  slug: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
```

### Organization with Users

```typescript
interface OrganizationWithUsers extends Organization {
  users: OrganizationUser[];
}
```

### OrganizationUser

```typescript
interface OrganizationUser {
  id: string;
  userId: string;
  organizationId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
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
  organizationId: string;
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
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
```

## User Roles

### OWNER

- Full administrative access
- Can delete organization
- Can manage all users and roles
- Can manage all content

### ADMIN

- Can manage users (except owners)
- Can manage channels and series
- Can manage organization settings
- Can moderate content

### MEMBER

- Can view and create content
- Can comment on videos
- Can participate in discussions
- Cannot manage users or organization settings

## Permissions

### Organization Actions

- **Create**: Any authenticated user
- **View**: Organization members only
- **Update**: Organization OWNER/ADMIN
- **Delete**: Organization OWNER only

### User Management

- **Add User**: Organization OWNER/ADMIN
- **Remove User**: Organization OWNER/ADMIN (cannot remove OWNER)
- **Update Role**: Organization OWNER/ADMIN (cannot modify OWNER)

### Channel/Series Management

- **Create**: Organization OWNER/ADMIN
- **Update**: Organization OWNER/ADMIN
- **Delete**: Organization OWNER/ADMIN

## Error Responses

### Organization Not Found

```json
{
  "success": false,
  "error": "Organization not found"
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
  "error": "Organization slug already exists"
}
```

## Organization Invitations

### Create Invitation

```http
POST /api/organizations/{id}/invitations
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
POST /api/organizations/invitations/accept
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
GET /api/organizations/{id}/invitations
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

### Organization Statistics

```http
GET /api/organizations/{id}/stats
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
GET /api/organizations/{id}/activity?limit=20
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
POST /api/organizations/{id}/users/bulk
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
PUT /api/organizations/{id}/users/bulk
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
// Create organization
const organization = await fetch("/api/organizations", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "My Team",
    slug: "my-team",
    description: "Team organization",
    ownerId: "user_123",
  }),
});

// Add user to organization
await fetch(`/api/organizations/${organizationId}/users`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    userId: "user_456",
    role: "MEMBER",
  }),
});
```

### React Hook

```typescript
import { useOrganizations } from "@/hooks/useOrganizations";

function OrganizationList() {
  const { organizations, loading, error } = useOrganizations();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {organizations.map((organization) => (
        <OrganizationCard key={organization.id} organization={organization} />
      ))}
    </div>
  );
}
```

## Rate Limits

- **Organization Creation**: 5 per hour per user
- **User Invitations**: 50 per day per organization
- **API Requests**: 100 per minute per user
