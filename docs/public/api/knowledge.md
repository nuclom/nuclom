# Knowledge Graph API

The Knowledge Graph API provides access to decisions extracted from videos and the relationships between people, topics, and artifacts.

## Decisions

### List Decisions

Retrieves a list of decisions with optional filters.

```http
GET /api/knowledge/decisions
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| videoId | string | No | Filter by video |
| status | string | No | Filter by status (proposed, decided, revisited, superseded) |
| type | string | No | Filter by type (technical, process, product, team, other) |
| topic | string | No | Filter by topic tag |
| person | string | No | Filter by participant name |
| search | string | No | Search in summary and context |

**Response:**

```json
{
  "decisions": [
    {
      "id": "uuid",
      "videoId": "uuid",
      "summary": "Adopt TypeScript for all new services",
      "context": "Discussion about improving code quality",
      "reasoning": "Better type safety and IDE support",
      "status": "decided",
      "decisionType": "technical",
      "timestampStart": 120,
      "timestampEnd": 180,
      "confidence": 85,
      "tags": ["typescript", "development"],
      "createdAt": "2024-01-15T10:30:00Z",
      "participants": [
        { "name": "John", "role": "decider" },
        { "name": "Sarah", "role": "participant" }
      ]
    }
  ]
}
```

### Get Decision

Retrieves a single decision by ID.

```http
GET /api/knowledge/decisions/{id}
```

**Response:**

```json
{
  "decision": {
    "id": "uuid",
    "videoId": "uuid",
    "summary": "Adopt TypeScript for all new services",
    "context": "Discussion about improving code quality",
    "reasoning": "Better type safety and IDE support",
    "status": "decided",
    "decisionType": "technical",
    "timestampStart": 120,
    "timestampEnd": 180,
    "confidence": 85,
    "tags": ["typescript", "development"],
    "metadata": {
      "alternatives": ["Continue with JavaScript", "Use Flow"],
      "externalRefs": [
        { "type": "github:pr", "id": "123", "url": "https://github.com/..." }
      ]
    },
    "createdAt": "2024-01-15T10:30:00Z",
    "participants": [
      { "id": "uuid", "name": "John", "role": "decider" }
    ],
    "video": {
      "id": "uuid",
      "title": "Engineering Sync - Jan 15"
    }
  }
}
```

### Create Decision

Creates a new decision manually.

```http
POST /api/knowledge/decisions
```

**Request Body:**

```json
{
  "organizationId": "uuid",
  "videoId": "uuid",
  "summary": "Use React Query for data fetching",
  "context": "Discussing state management approaches",
  "reasoning": "Better caching and automatic refetching",
  "status": "decided",
  "decisionType": "technical",
  "timestampStart": 300,
  "timestampEnd": 360,
  "tags": ["react", "state-management"],
  "participants": [
    { "name": "Alice", "role": "decider" }
  ]
}
```

### Update Decision

Updates an existing decision.

```http
PUT /api/knowledge/decisions/{id}
```

**Request Body:** (partial update allowed)

```json
{
  "status": "superseded",
  "reasoning": "Updated reasoning after further discussion"
}
```

### Delete Decision

Deletes a decision.

```http
DELETE /api/knowledge/decisions/{id}
```

## Timeline

### Get Decision Timeline

Retrieves decisions in chronological order within a date range.

```http
GET /api/knowledge/timeline
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| startDate | string | No | Start of date range (ISO 8601) |
| endDate | string | No | End of date range (ISO 8601) |
| topic | string | No | Filter by topic tag |

**Response:**

```json
{
  "decisions": [
    {
      "id": "uuid",
      "summary": "Adopt TypeScript",
      "status": "decided",
      "decisionType": "technical",
      "createdAt": "2024-01-15T10:30:00Z",
      "video": {
        "id": "uuid",
        "title": "Engineering Sync"
      }
    }
  ]
}
```

## Context

### Get Decisions by Artifact

Retrieves all decisions linked to a specific external artifact.

```http
GET /api/knowledge/context
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| artifactType | string | Yes | Type of artifact (e.g., "github:pr", "jira:issue") |
| artifactId | string | Yes | External artifact identifier |

**Response:**

```json
{
  "decisions": [
    {
      "id": "uuid",
      "summary": "Implement feature as discussed",
      "status": "decided",
      "video": {
        "id": "uuid",
        "title": "Sprint Planning"
      }
    }
  ]
}
```

## Graph

### Get Knowledge Graph

Retrieves the knowledge graph for visualization.

```http
GET /api/knowledge/graph
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |

**Response:**

```json
{
  "nodes": [
    {
      "id": "uuid",
      "type": "person",
      "label": "John Smith",
      "metadata": {}
    },
    {
      "id": "uuid",
      "type": "topic",
      "label": "TypeScript",
      "metadata": {}
    },
    {
      "id": "uuid",
      "type": "decision",
      "label": "Adopt TypeScript",
      "metadata": { "status": "decided" }
    }
  ],
  "edges": [
    {
      "id": "uuid",
      "sourceNodeId": "uuid",
      "targetNodeId": "uuid",
      "relationshipType": "made_by"
    }
  ]
}
```

## Video Decisions

### Get Decisions for Video

Retrieves all decisions from a specific video.

```http
GET /api/videos/{id}/decisions
```

**Response:**

```json
{
  "decisions": [
    {
      "id": "uuid",
      "summary": "Use REST API for external integrations",
      "timestampStart": 120,
      "timestampEnd": 180,
      "status": "decided",
      "decisionType": "technical",
      "participants": [
        { "name": "Sarah", "role": "decider" }
      ]
    }
  ]
}
```

## Data Types

### Decision Status

| Value | Description |
|-------|-------------|
| proposed | Decision was proposed but not finalized |
| decided | Decision was made and agreed upon |
| revisited | Decision is being reconsidered |
| superseded | Decision was replaced by a newer one |

### Decision Type

| Value | Description |
|-------|-------------|
| technical | Technical implementation decisions |
| process | Process or workflow decisions |
| product | Product feature or direction decisions |
| team | Team structure or people decisions |
| other | Other types of decisions |

### Participant Role

| Value | Description |
|-------|-------------|
| decider | Person who made the final decision |
| participant | Person actively involved in discussion |
| mentioned | Person referenced but not present |

### Artifact Types

| Type | Description |
|------|-------------|
| github:pr | GitHub Pull Request |
| github:issue | GitHub Issue |
| google:doc | Google Document |
| notion:page | Notion Page |
| jira:issue | Jira Issue |
| linear:issue | Linear Issue |
| figma:file | Figma File |

## Error Responses

All endpoints return standard error responses:

```json
{
  "error": "Description of the error"
}
```

Common HTTP status codes:
- `400` - Bad Request (missing or invalid parameters)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error
