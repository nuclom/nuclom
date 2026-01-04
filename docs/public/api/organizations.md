# Organizations API

The Organizations API provides endpoints for managing team organizations, member roles, and organizational structure for video collaboration.

> **Note**: For complete endpoint documentation including request/response schemas, see the [OpenAPI specification](/openapi.json) or the [Interactive API Reference](/docs/api/reference).

## Overview

Organizations are the top-level entity for team collaboration. Each organization can have multiple members, channels, and series to organize video content.

## Key Concepts

### Member Roles

Organizations support two roles:

- **owner**: Full administrative access including deletion rights and member management
- **member**: Can view and create content but cannot manage organization settings

### Organization Ownership

Every organization has exactly one owner who has full control including:

- Managing organization settings
- Adding/removing members
- Updating member roles
- Deleting the organization

### Organization Slug

Each organization has a unique slug used in URLs (e.g., `/org/my-team/videos`). Slugs must be:
- Lowercase alphanumeric with hyphens
- Unique across all organizations
- 3-50 characters long

## Data Models

### Organization

```typescript
interface Organization {
  id: string;          // UUID
  name: string;        // Display name
  slug: string;        // URL-safe identifier
  description?: string;
  logo?: string;       // Logo image URL
  createdAt: string;   // ISO 8601 timestamp
  updatedAt: string;   // ISO 8601 timestamp
}
```

### OrganizationMember

```typescript
interface OrganizationMember {
  id: string;
  organizationId: string;
  userId: string;
  role: "owner" | "member";
  user?: User;         // Included when fetching members
  createdAt: string;
}
```

## API Endpoints

The following endpoints are available. See the OpenAPI spec for full details.

| Endpoint | Description |
|----------|-------------|
| `GET /organizations` | List organizations for the current user |
| `POST /organizations` | Create a new organization |
| `GET /organizations/{id}` | Get organization details |
| `PATCH /organizations/{id}/settings` | Update organization settings |
| `GET /organizations/{id}/members` | List organization members |
| `PATCH /organizations/{id}/members` | Update a member's role |
| `DELETE /organizations/{id}/members` | Remove a member |

## Permissions

| Action | Required Role |
|--------|--------------|
| View organization | Any member |
| Create organization | Any authenticated user |
| Update settings | Owner |
| Delete organization | Owner |
| Add/remove members | Owner |
| Update member roles | Owner |

## Error Codes

| Code | Description |
|------|-------------|
| `NOT_FOUND_ORGANIZATION` | Organization not found |
| `AUTH_FORBIDDEN` | User lacks permission |
| `CONFLICT_DUPLICATE` | Slug already exists |

## Usage Examples

### JavaScript/TypeScript

```typescript
// Get organization members
const response = await fetch(`/api/organizations/${orgId}/members`, {
  headers: { "Authorization": `Bearer ${token}` }
});
const members = await response.json();

// Update member role
await fetch(`/api/organizations/${orgId}/members`, {
  method: "PATCH",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    userId: "user_123",
    role: "member"
  })
});
```
