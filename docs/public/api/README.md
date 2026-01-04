# Nuclom API

> Build integrations with Nuclom's RESTful API.

**Base URL:** `https://nuclom.com/api`

---

## Quick Start

### 1. Authenticate

```bash
# Get a session token via OAuth or email/password
POST /api/auth/sign-in
```

### 2. Make a Request

```bash
curl -X GET "https://nuclom.com/api/videos" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

### 3. Handle the Response

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": { "page": 1, "total": 42 }
  }
}
```

---

## API Reference

### Core Endpoints

| Section | Description | Documentation |
| ------- | ----------- | ------------- |
| **Authentication** | Sign up, sign in, OAuth, sessions | [authentication.md](authentication.md) |
| **Videos** | Upload, manage, and stream videos | [videos.md](videos.md) |
| **Organizations** | Teams, members, and permissions | [organizations.md](organizations.md) |
| **Comments** | Time-stamped discussions | [comments.md](comments.md) |
| **Notifications** | User notifications | [notifications.md](notifications.md) |

### AI & Analytics

| Section | Description | Documentation |
| ------- | ----------- | ------------- |
| **AI Services** | Summaries, transcripts, action items | [ai.md](ai.md) |
| **Knowledge** | Knowledge graphs, decisions | [knowledge.md](knowledge.md) |
| **Insights** | Video analytics and metrics | [insights.md](insights.md) |

### Utilities

| Section | Description | Documentation |
| ------- | ----------- | ------------- |
| **Embed** | Video embedding and sharing | [embed.md](embed.md) |
| **Errors** | Error codes and handling | [errors.md](errors.md) |

---

## Interactive Reference

For a complete, interactive API reference:

- **Web:** [/docs/api/reference](/docs/api/reference)
- **OpenAPI JSON:** [/openapi.json](/openapi.json)
- **OpenAPI YAML:** [/openapi.yaml](/openapi.yaml)

Regenerate the spec:
```bash
pnpm openapi
```

---

## Authentication

Nuclom uses session-based authentication with Better-Auth.

### Methods

| Method | Best for |
| ------ | -------- |
| **OAuth** | GitHub, Google sign-in |
| **Email/Password** | Traditional authentication |
| **Session tokens** | API requests |

See [Authentication](authentication.md) for details.

---

## Request Format

### Headers

```http
Authorization: Bearer YOUR_SESSION_TOKEN
Content-Type: application/json
```

### Pagination

List endpoints support pagination:

| Parameter | Default | Max | Description |
| --------- | ------- | --- | ----------- |
| `page` | 1 | — | Page number |
| `limit` | 20 | 100 | Items per page |

---

## Response Format

### Success

```json
{
  "success": true,
  "data": {
    // Response payload
  }
}
```

### Paginated Success

```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}
```

### Error

```json
{
  "success": false,
  "error": "Error message describing what went wrong"
}
```

---

## HTTP Status Codes

| Code | Meaning | When |
| ---- | ------- | ---- |
| `200` | OK | Request succeeded |
| `201` | Created | Resource created |
| `400` | Bad Request | Invalid parameters |
| `401` | Unauthorized | Missing or invalid auth |
| `403` | Forbidden | Insufficient permissions |
| `404` | Not Found | Resource doesn't exist |
| `429` | Too Many Requests | Rate limit exceeded |
| `500` | Server Error | Something went wrong |

---

## Rate Limits

| Limit | Value |
| ----- | ----- |
| Per IP (unauthenticated) | 100 requests/minute |
| Per user (authenticated) | 1,000 requests/hour |

When rate limited, you'll receive a `429` response with a `Retry-After` header.

---

## Data Models

### User

```typescript
interface User {
  id: string
  email: string
  name: string
  avatarUrl?: string
  createdAt: string
  updatedAt: string
}
```

### Organization

```typescript
interface Organization {
  id: string
  name: string
  slug: string
  description?: string
  createdAt: string
  updatedAt: string
}
```

### Video

```typescript
interface Video {
  id: string
  title: string
  description?: string
  duration: string
  thumbnailUrl?: string
  videoUrl?: string
  authorId: string
  organizationId: string
  channelId?: string
  seriesId?: string
  transcript?: string
  aiSummary?: string
  createdAt: string
  updatedAt: string
}
```

### Comment

```typescript
interface Comment {
  id: string
  content: string
  timestamp?: string    // Video timestamp (e.g., "01:23")
  authorId: string
  videoId: string
  parentId?: string     // For threaded replies
  createdAt: string
  updatedAt: string
}
```

---

## SDKs

Official SDKs:

| Language | Package |
| -------- | ------- |
| JavaScript/TypeScript | `@nuclom/sdk` |
| Python | `nuclom` |
| React | `@nuclom/react` |

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

---

## Support

- **Documentation:** [docs.nuclom.com](https://docs.nuclom.com)
- **Email:** api-support@nuclom.com
- **Issues:** [github.com/nuclom/api-issues](https://github.com/nuclom/api-issues)
