# Decisions API

The Decisions API provides endpoints for managing the Decision Registry - a feature for tracking team decisions extracted from meetings or created manually.

## Base URL

All decision endpoints are prefixed with `/api/decisions`.

## Authentication

All endpoints require authentication. Include a valid session cookie or Bearer token.

## Endpoints

### List Decisions

```http
GET /api/decisions
```

Fetches paginated decisions for an organization with optional filters.

**Query Parameters:**

| Parameter        | Type   | Required | Description                                     |
|-----------------|--------|----------|-------------------------------------------------|
| organizationId  | string | Yes      | The organization ID                             |
| page            | number | No       | Page number (default: 1)                        |
| limit           | number | No       | Items per page (default: 20, max: 100)          |
| status          | string | No       | Filter by status: `decided`, `proposed`, `superseded` |
| source          | string | No       | Filter by source: `meeting`, `adhoc`, `manual`  |
| topics          | string | No       | Comma-separated tag names                        |
| participants    | string | No       | Comma-separated user IDs                         |
| from            | string | No       | Start date (ISO 8601)                           |
| to              | string | No       | End date (ISO 8601)                             |
| search          | string | No       | Full-text search query                          |
| videoId         | string | No       | Filter by linked video                          |

**Response:**

```json
{
  "data": [
    {
      "id": "dec_123",
      "organizationId": "org_456",
      "summary": "We will use TypeScript for all new projects",
      "context": "Discussed during the architecture review meeting...",
      "source": "meeting",
      "status": "decided",
      "decidedAt": "2024-01-15T10:00:00Z",
      "participants": [
        { "id": "p_1", "user": { "id": "u_1", "name": "John Doe", "email": "john@example.com" } }
      ],
      "tagAssignments": [
        { "id": "ta_1", "tag": { "id": "t_1", "name": "architecture", "color": "#3B82F6" } }
      ],
      "participantCount": 3,
      "tagCount": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

### Get Decision

```http
GET /api/decisions/:id
```

Fetches a single decision with full details including participants, tags, links, and edit history.

**Response:**

```json
{
  "id": "dec_123",
  "organizationId": "org_456",
  "summary": "We will use TypeScript for all new projects",
  "context": "Full rationale and background...",
  "source": "meeting",
  "status": "decided",
  "decidedAt": "2024-01-15T10:00:00Z",
  "videoId": "vid_789",
  "videoTimestamp": 1234,
  "createdById": "u_1",
  "participants": [...],
  "tagAssignments": [...],
  "links": [
    { "id": "l_1", "targetDecisionId": "dec_456", "linkType": "related" }
  ],
  "edits": [
    { "id": "e_1", "fieldChanged": "summary", "oldValue": "...", "newValue": "...", "editedAt": "..." }
  ]
}
```

### Create Decision

```http
POST /api/decisions
```

Creates a new decision.

**Request Body:**

```json
{
  "organizationId": "org_456",
  "summary": "We will use TypeScript for all new projects",
  "context": "Discussed during the architecture review meeting...",
  "source": "manual",
  "status": "decided",
  "decidedAt": "2024-01-15T10:00:00Z",
  "videoId": "vid_789",
  "videoTimestamp": 1234,
  "participantIds": ["u_1", "u_2"],
  "tagIds": ["t_1", "t_2"]
}
```

**Response:** Returns the created decision object.

### Update Decision

```http
PATCH /api/decisions/:id
```

Updates an existing decision. Creates an audit trail entry for each field changed.

**Request Body:**

```json
{
  "summary": "Updated decision summary",
  "context": "Updated context...",
  "status": "superseded"
}
```

### Delete Decision

```http
DELETE /api/decisions/:id
```

Deletes a decision and all associated data (participants, tags, links).

## Tags

### List Tags

```http
GET /api/decisions/tags
```

Lists all tags for an organization.

**Query Parameters:**

| Parameter       | Type   | Required | Description          |
|----------------|--------|----------|----------------------|
| organizationId | string | Yes      | The organization ID  |

### Create Tag

```http
POST /api/decisions/tags
```

Creates a new tag.

**Request Body:**

```json
{
  "organizationId": "org_456",
  "name": "architecture",
  "color": "#3B82F6"
}
```

### Assign Tag to Decision

```http
POST /api/decisions/:id/tags
```

Assigns an existing tag to a decision.

**Request Body:**

```json
{
  "tagId": "t_1"
}
```

### Remove Tag from Decision

```http
DELETE /api/decisions/:id/tags
```

Removes a tag from a decision.

**Request Body:**

```json
{
  "tagId": "t_1"
}
```

## Participants

### Add Participant

```http
POST /api/decisions/:id/participants
```

Adds a participant to a decision.

**Request Body:**

```json
{
  "userId": "u_1"
}
```

### Remove Participant

```http
DELETE /api/decisions/:id/participants
```

Removes a participant from a decision.

**Request Body:**

```json
{
  "userId": "u_1"
}
```

## Links

### Create Link

```http
POST /api/decisions/:id/links
```

Creates a link between two decisions.

**Request Body:**

```json
{
  "targetDecisionId": "dec_456",
  "linkType": "related"
}
```

Link types: `related`, `supersedes`, `depends_on`

### Delete Link

```http
DELETE /api/decisions/:id/links
```

Removes a link between decisions.

**Request Body:**

```json
{
  "targetDecisionId": "dec_456"
}
```

## Supersession

### Supersede Decision

```http
POST /api/decisions/:id/supersede
```

Creates a new decision that supersedes an existing one. The old decision's status is changed to `superseded`.

**Request Body:**

```json
{
  "summary": "New approach: Use strict TypeScript configuration",
  "context": "After evaluating the previous decision..."
}
```

## Subscriptions

### Get Subscription

```http
GET /api/decisions/subscriptions
```

Gets the user's subscription for a specific tag.

**Query Parameters:**

| Parameter | Type   | Required | Description |
|-----------|--------|----------|-------------|
| tagId     | string | Yes      | The tag ID  |

### Create/Update Subscription

```http
POST /api/decisions/subscriptions
```

Creates or updates a subscription to a decision tag.

**Request Body:**

```json
{
  "tagId": "t_1",
  "frequency": "daily"
}
```

Frequency options: `instant`, `daily`, `weekly`

## Export

### Export Decisions

```http
GET /api/decisions/export
```

Exports decisions in various formats.

**Query Parameters:**

| Parameter       | Type   | Required | Description                                     |
|----------------|--------|----------|-------------------------------------------------|
| organizationId | string | Yes      | The organization ID                             |
| format         | string | Yes      | Export format: `json`, `markdown`, `csv`        |
| status         | string | No       | Filter by status                                |
| source         | string | No       | Filter by source                                |
| topics         | string | No       | Comma-separated tag names                        |
| from           | string | No       | Start date                                      |
| to             | string | No       | End date                                        |

**Response:**

Returns a file download with appropriate content type:
- JSON: `application/json`
- Markdown: `text/markdown`
- CSV: `text/csv`

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

Common error codes:
- `UNAUTHORIZED` - Authentication required
- `FORBIDDEN` - Insufficient permissions
- `NOT_FOUND` - Decision not found
- `VALIDATION_ERROR` - Invalid request data
- `MISSING_FIELD` - Required field missing
