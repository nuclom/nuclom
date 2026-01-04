# AI Insights API

The AI Insights API provides aggregated intelligence from video meetings, including topic trends, action items, meeting effectiveness metrics, and keyword analysis.

## Overview

### Get Insights Overview

Retrieves summary metrics for organization-wide AI insights.

```http
GET /api/insights/overview
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |

**Response:**

```json
{
  "overview": {
    "totalVideosAnalyzed": 45,
    "totalHoursAnalyzed": 23,
    "totalDecisions": 128,
    "avgConfidence": 82,
    "actionItems": {
      "total": 89,
      "pending": 34,
      "inProgress": 12,
      "completed": 43,
      "completionRate": 48
    }
  },
  "trends": {
    "videosChange": 15
  },
  "period": "30d"
}
```

## Topics

### List Topics

Retrieves topic trends with rise/decline indicators.

```http
GET /api/insights/topics
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |
| limit | number | No | Max topics to return (1-50, default: 20) |

**Response:**

```json
{
  "topics": [
    {
      "id": "uuid",
      "name": "API Design",
      "mentionCount": 45,
      "videoCount": 12,
      "trend": "rising",
      "trendScore": 35,
      "keywords": ["rest", "graphql", "endpoints"],
      "lastMentionedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "summary": {
    "totalTopics": 28,
    "risingCount": 8,
    "decliningCount": 4
  },
  "trending": {
    "rising": [...],
    "declining": [...]
  },
  "period": "30d"
}
```

## Action Items

### List Action Items

Retrieves organization-wide action items from all videos.

```http
GET /api/insights/action-items
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |
| status | string | No | Filter: pending, in_progress, completed, cancelled |
| priority | string | No | Filter: high, medium, low |
| assigneeUserId | string | No | Filter by assignee user ID |
| videoId | string | No | Filter by source video |
| page | number | No | Page number (default: 1) |
| limit | number | No | Items per page (1-100, default: 20) |

**Response:**

```json
{
  "actionItems": [
    {
      "id": "uuid",
      "title": "Update API documentation",
      "description": "Add examples for new endpoints",
      "assignee": "John",
      "assigneeUserId": "uuid",
      "status": "pending",
      "priority": "high",
      "dueDate": "2024-01-20T00:00:00Z",
      "timestampStart": 120,
      "videoId": "uuid",
      "createdAt": "2024-01-15T10:30:00Z",
      "video": {
        "id": "uuid",
        "title": "Sprint Planning",
        "thumbnailUrl": "https://..."
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "totalCount": 89,
    "totalPages": 5,
    "hasMore": true
  },
  "stats": {
    "pending": 34,
    "inProgress": 12,
    "completed": 43,
    "cancelled": 0,
    "total": 89
  },
  "period": "30d"
}
```

### Create Action Item

Creates a new action item.

```http
POST /api/insights/action-items
```

**Request Body:**

```json
{
  "organizationId": "uuid",
  "videoId": "uuid",
  "title": "Follow up with client",
  "description": "Schedule demo call",
  "assignee": "Sarah",
  "priority": "high",
  "dueDate": "2024-01-25T00:00:00Z"
}
```

### Update Action Item

Updates an existing action item.

```http
PATCH /api/insights/action-items/{id}
```

**Request Body:**

```json
{
  "status": "completed",
  "priority": "medium"
}
```

### Delete Action Item

Deletes an action item.

```http
DELETE /api/insights/action-items/{id}
```

## Meeting Effectiveness

### Get Effectiveness Metrics

Retrieves meeting effectiveness scores and metrics.

```http
GET /api/insights/effectiveness
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |

**Response:**

```json
{
  "metrics": {
    "totalMeetings": 45,
    "avgDurationMinutes": 32,
    "totalDecisions": 128,
    "avgDecisionsPerMeeting": 2.8,
    "decisionRate": 78,
    "totalActionItems": 89,
    "completedActionItems": 43,
    "avgActionItemsPerMeeting": 2.0,
    "actionItemCompletionRate": 48,
    "avgEngagement": 72,
    "totalViews": 234
  },
  "effectivenessScore": 68,
  "scoreBreakdown": {
    "decisionMaking": 78,
    "followThrough": 48,
    "engagement": 72,
    "consistency": 80
  },
  "weeklyTrends": [
    {
      "week": "2024-01-08T00:00:00Z",
      "meetingCount": 12,
      "avgDurationMinutes": 28
    }
  ],
  "period": "30d"
}
```

## Keywords

### Get Keywords

Retrieves keyword frequency data for word cloud visualization.

```http
GET /api/insights/keywords
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |
| limit | number | No | Max keywords to return (10-100, default: 50) |

**Response:**

```json
{
  "keywords": [
    {
      "word": "api",
      "count": 45,
      "weight": 10
    },
    {
      "word": "deployment",
      "count": 32,
      "weight": 7
    }
  ],
  "summary": {
    "totalKeywords": 50,
    "totalOccurrences": 423
  },
  "categories": {
    "technical": [...],
    "product": [...],
    "process": [...]
  },
  "period": "30d"
}
```

## Summary

### Get Weekly/Monthly Summary

Retrieves a digest-style summary with highlights and recommendations.

```http
GET /api/insights/summary
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 7d) |

**Response:**

```json
{
  "summary": {
    "period": "7d",
    "periodLabel": "Last 7 days",
    "generatedAt": "2024-01-15T10:30:00Z"
  },
  "stats": {
    "totalVideos": 12,
    "totalHours": 8.5,
    "totalDecisions": 28,
    "actionItems": {
      "total": 34,
      "completed": 18,
      "pending": 12,
      "completionRate": 53
    }
  },
  "highlights": [
    "Analyzed 12 videos (8.5 hours of content)",
    "Captured 28 key decisions",
    "Completed 18 action items (53% completion rate)"
  ],
  "recommendations": [
    "Consider balancing speaking time. Speaker A contributed most this period."
  ],
  "topSpeakers": [
    { "name": "Speaker A", "speakingTime": 12000, "videoCount": 8 },
    { "name": "Speaker B", "speakingTime": 8500, "videoCount": 6 }
  ],
  "topVideos": [
    { "id": "video-1", "title": "Team Standup", "views": 45 }
  ]
}
```

## Patterns

### Get Meeting Patterns

Analyzes team meeting patterns including time distribution and speaker collaboration.

```http
GET /api/insights/patterns
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |

**Response:**

```json
{
  "timeDistribution": {
    "heatmap": [
      {
        "day": "Monday",
        "hours": [
          { "hour": 0, "count": 0 },
          { "hour": 9, "count": 5 },
          { "hour": 14, "count": 3 }
        ]
      }
    ],
    "peakTimes": [
      { "day": "Monday", "hour": 9, "count": 5 },
      { "day": "Tuesday", "hour": 10, "count": 4 }
    ]
  },
  "speakerPatterns": {
    "participants": [
      { "name": "Speaker A", "videoCount": 12, "totalSpeakingTime": 15000, "avgSpeakingPercent": 35 }
    ],
    "coAppearances": [
      { "speaker1": "Speaker A", "speaker2": "Speaker B", "count": 8 }
    ],
    "participationBalance": 75
  },
  "meetingFrequency": {
    "weekly": [
      { "week": "2024-01-08", "count": 5, "totalDuration": 7200 }
    ],
    "stats": {
      "avgDurationMinutes": 45,
      "minDurationMinutes": 15,
      "maxDurationMinutes": 90,
      "totalMeetings": 20
    }
  }
}
```

## Export

### Export Meeting Data

Exports meeting data in CSV or JSON format.

```http
GET /api/insights/export
```

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| organizationId | string | Yes | Organization ID |
| period | string | No | Time period: 7d, 30d, 90d, all (default: 30d) |
| format | string | No | Export format: csv, json (default: csv) |
| type | string | No | Data type: all, videos, decisions, action-items, speakers (default: all) |

**Response:**

Returns a file download with the requested data format.

For CSV format, the file includes sections for each data type with headers:
- Videos: ID, Title, Description, Duration, Created At, Has Summary
- Decisions: ID, Summary, Context, Status, Type, Video ID, Created At
- Action Items: ID, Title, Description, Assignee, Status, Priority, Due Date, Completed At, Video ID, Confidence, Created At
- Speakers: Video ID, Speaker Label, Speaking Time, Speaking %, Segment Count

## Database Schema

The insights feature uses the following tables:

### ai_topics

Aggregated topic tracking with trend analysis.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organizationId | uuid | Organization reference |
| name | text | Topic name |
| normalizedName | text | Lowercase name for deduplication |
| mentionCount | integer | Total mentions |
| videoCount | integer | Videos mentioning this topic |
| trend | enum | rising, stable, declining |
| trendScore | integer | -100 to 100 |
| keywords | jsonb | Related keywords array |
| lastMentionedAt | timestamp | Last mention time |

### ai_action_items

Organization-wide action items with tracking.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| organizationId | uuid | Organization reference |
| videoId | uuid | Source video reference |
| title | text | Action item title |
| description | text | Optional description |
| assignee | text | Assignee name |
| assigneeUserId | uuid | Linked user (optional) |
| status | enum | pending, in_progress, completed, cancelled |
| priority | enum | high, medium, low |
| dueDate | timestamp | Optional due date |
| completedAt | timestamp | Completion timestamp |
| timestampStart | integer | Video timestamp in seconds |
