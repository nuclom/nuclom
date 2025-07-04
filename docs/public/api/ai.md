# AI Services API

The AI Services API provides intelligent analysis and processing capabilities for video content, including transcript analysis, summarization, and action item extraction.

## Overview

Nuclom's AI integration leverages advanced language models to provide:
- Video transcript analysis
- Intelligent summarization
- Action item extraction
- Content insights and recommendations
- Meeting highlights detection

## Endpoints

### Analyze Video Content

Analyze video transcripts to generate summaries or extract action items.

```http
POST /api/ai/analyze
Content-Type: application/json
```

**Request Body:**
```json
{
  "transcript": "In today's meeting, we discussed the Q1 roadmap and decided to prioritize three main features: user authentication, video upload optimization, and AI-powered search. John will lead the authentication work, Sarah will handle the video optimization, and Mike will work on the search functionality. We need to complete these by March 15th.",
  "type": "summary"
}
```

**Parameters:**
- `transcript` (string, required): Video transcript text
- `type` (string, required): Analysis type (`summary` or `action-items`)

**Response for Summary:**
```json
{
  "success": true,
  "data": {
    "result": {
      "summary": "Team meeting focused on Q1 roadmap priorities including user authentication, video upload optimization, and AI-powered search functionality. Tasks were assigned to team members with a March 15th deadline.",
      "keyPoints": [
        "Q1 roadmap discussion",
        "Three main features prioritized",
        "Tasks assigned to team members",
        "March 15th deadline established"
      ],
      "duration": "5 minutes",
      "confidence": 0.95
    },
    "type": "summary"
  }
}
```

**Response for Action Items:**
```json
{
  "success": true,
  "data": {
    "result": {
      "actionItems": [
        {
          "id": "ai_1",
          "task": "Lead user authentication development",
          "assignee": "John",
          "deadline": "March 15th",
          "priority": "high",
          "status": "pending"
        },
        {
          "id": "ai_2",
          "task": "Handle video upload optimization",
          "assignee": "Sarah",
          "deadline": "March 15th",
          "priority": "high",
          "status": "pending"
        },
        {
          "id": "ai_3",
          "task": "Work on AI-powered search functionality",
          "assignee": "Mike",
          "deadline": "March 15th",
          "priority": "high",
          "status": "pending"
        }
      ],
      "totalItems": 3,
      "confidence": 0.92
    },
    "type": "action-items"
  }
}
```

### Generate Video Summary

Generate a comprehensive summary of video content.

```http
POST /api/ai/summary
Content-Type: application/json
```

**Request Body:**
```json
{
  "videoId": "video_123",
  "transcript": "Full transcript text...",
  "options": {
    "length": "brief",
    "includeTimestamps": true,
    "includeKeyPoints": true
  }
}
```

**Parameters:**
- `videoId` (string, optional): Video ID for reference
- `transcript` (string, required): Video transcript
- `options` (object, optional): Summary options
  - `length` (string): `brief`, `detailed`, or `comprehensive`
  - `includeTimestamps` (boolean): Include timestamp references
  - `includeKeyPoints` (boolean): Include key points list

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "summary": {
      "title": "Q1 Planning Meeting Summary",
      "overview": "Team planning session covering Q1 objectives, feature priorities, and resource allocation.",
      "keyPoints": [
        {
          "point": "User authentication system prioritized",
          "timestamp": "00:05:30",
          "importance": "high"
        },
        {
          "point": "Video optimization requirements discussed",
          "timestamp": "00:12:15",
          "importance": "medium"
        }
      ],
      "conclusion": "Clear action items assigned with March 15th deadline for completion.",
      "duration": "25 minutes",
      "participants": ["John", "Sarah", "Mike"],
      "confidence": 0.94
    },
    "metadata": {
      "analysisTime": "2.3 seconds",
      "modelUsed": "gpt-4",
      "language": "en"
    }
  }
}
```

### Extract Action Items

Extract actionable tasks and assignments from video content.

```http
POST /api/ai/action-items
Content-Type: application/json
```

**Request Body:**
```json
{
  "videoId": "video_123",
  "transcript": "Full transcript text...",
  "options": {
    "includeDeadlines": true,
    "includeAssignees": true,
    "priorityLevel": "all"
  }
}
```

**Parameters:**
- `videoId` (string, optional): Video ID for reference
- `transcript` (string, required): Video transcript
- `options` (object, optional): Extraction options
  - `includeDeadlines` (boolean): Extract deadline information
  - `includeAssignees` (boolean): Identify task assignees
  - `priorityLevel` (string): Filter by priority (`high`, `medium`, `low`, `all`)

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "actionItems": [
      {
        "id": "ai_001",
        "task": "Implement user authentication system",
        "description": "Develop secure login and registration functionality with email verification",
        "assignee": "John",
        "deadline": "2024-03-15",
        "priority": "high",
        "status": "pending",
        "timestamp": "00:07:22",
        "tags": ["authentication", "security", "backend"],
        "estimatedEffort": "2 weeks"
      },
      {
        "id": "ai_002",
        "task": "Optimize video upload process",
        "description": "Improve video processing pipeline for better performance",
        "assignee": "Sarah",
        "deadline": "2024-03-15",
        "priority": "high",
        "status": "pending",
        "timestamp": "00:14:45",
        "tags": ["performance", "video", "optimization"],
        "estimatedEffort": "3 weeks"
      }
    ],
    "summary": {
      "totalItems": 2,
      "highPriority": 2,
      "mediumPriority": 0,
      "lowPriority": 0,
      "withDeadlines": 2,
      "withAssignees": 2
    },
    "metadata": {
      "analysisTime": "1.8 seconds",
      "confidence": 0.91,
      "language": "en"
    }
  }
}
```

### Generate Meeting Highlights

Extract key highlights and important moments from meetings.

```http
POST /api/ai/highlights
Content-Type: application/json
```

**Request Body:**
```json
{
  "videoId": "video_123",
  "transcript": "Full transcript text...",
  "options": {
    "maxHighlights": 5,
    "includeTimestamps": true,
    "highlightTypes": ["decisions", "announcements", "questions"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "highlights": [
      {
        "id": "highlight_001",
        "type": "decision",
        "title": "Q1 Feature Prioritization",
        "description": "Team decided to prioritize user authentication as the top Q1 feature",
        "timestamp": "00:08:30",
        "duration": "00:02:15",
        "importance": "high",
        "participants": ["John", "Sarah", "Mike"]
      },
      {
        "id": "highlight_002",
        "type": "announcement",
        "title": "New Team Member",
        "description": "Announcement of new developer joining the team next month",
        "timestamp": "00:20:45",
        "duration": "00:01:30",
        "importance": "medium",
        "participants": ["Team Lead"]
      }
    ],
    "summary": {
      "totalHighlights": 2,
      "totalDuration": "00:03:45",
      "averageImportance": "high"
    }
  }
}
```

### Analyze Sentiment

Analyze the sentiment and tone of video content.

```http
POST /api/ai/sentiment
Content-Type: application/json
```

**Request Body:**
```json
{
  "videoId": "video_123",
  "transcript": "Full transcript text..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "video_123",
    "sentiment": {
      "overall": {
        "score": 0.7,
        "label": "positive",
        "confidence": 0.89
      },
      "segments": [
        {
          "start": "00:00:00",
          "end": "00:05:00",
          "score": 0.6,
          "label": "neutral",
          "confidence": 0.85
        },
        {
          "start": "00:05:00",
          "end": "00:10:00",
          "score": 0.8,
          "label": "positive",
          "confidence": 0.92
        }
      ],
      "emotions": {
        "enthusiasm": 0.75,
        "concern": 0.25,
        "confidence": 0.80,
        "satisfaction": 0.70
      }
    }
  }
}
```

## Data Models

### Analysis Request

```typescript
interface AnalysisRequest {
  transcript: string;
  type: 'summary' | 'action-items' | 'highlights' | 'sentiment';
  videoId?: string;
  options?: AnalysisOptions;
}
```

### Analysis Options

```typescript
interface AnalysisOptions {
  length?: 'brief' | 'detailed' | 'comprehensive';
  includeTimestamps?: boolean;
  includeKeyPoints?: boolean;
  includeDeadlines?: boolean;
  includeAssignees?: boolean;
  priorityLevel?: 'high' | 'medium' | 'low' | 'all';
  maxHighlights?: number;
  highlightTypes?: string[];
}
```

### Summary Result

```typescript
interface SummaryResult {
  title: string;
  overview: string;
  keyPoints: KeyPoint[];
  conclusion: string;
  duration: string;
  participants: string[];
  confidence: number;
}
```

### Action Item

```typescript
interface ActionItem {
  id: string;
  task: string;
  description: string;
  assignee: string;
  deadline: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed';
  timestamp: string;
  tags: string[];
  estimatedEffort: string;
}
```

### Highlight

```typescript
interface Highlight {
  id: string;
  type: 'decision' | 'announcement' | 'question' | 'action';
  title: string;
  description: string;
  timestamp: string;
  duration: string;
  importance: 'high' | 'medium' | 'low';
  participants: string[];
}
```

## Error Responses

### Missing Transcript

```json
{
  "success": false,
  "error": "Transcript is required"
}
```

### Invalid Analysis Type

```json
{
  "success": false,
  "error": "Invalid analysis type. Must be 'summary' or 'action-items'"
}
```

### AI Service Error

```json
{
  "success": false,
  "error": "Failed to analyze content"
}
```

### Rate Limit Exceeded

```json
{
  "success": false,
  "error": "AI analysis rate limit exceeded. Please try again later."
}
```

## Authentication

All AI endpoints require authentication:

```http
Authorization: Bearer <session_token>
```

## Rate Limits

- **AI Analysis**: 50 requests per hour per user
- **Batch Processing**: 10 requests per minute per user
- **Large Transcripts**: 5 requests per hour per user (>10,000 characters)

## Usage Limits

- **Free Tier**: 100 AI analyses per month
- **Pro Tier**: 1,000 AI analyses per month
- **Enterprise**: Unlimited with fair usage

## Supported Languages

- English (en)
- Spanish (es)
- French (fr)
- German (de)
- Italian (it)
- Portuguese (pt)
- Japanese (ja)
- Chinese (zh)

## AI Models

### Available Models

- **GPT-4**: High-quality analysis, slower processing
- **GPT-3.5-turbo**: Fast analysis, good quality
- **Claude**: Alternative model for specific use cases

### Model Selection

```http
POST /api/ai/analyze
Content-Type: application/json

{
  "transcript": "...",
  "type": "summary",
  "model": "gpt-4",
  "options": {
    "temperature": 0.7,
    "maxTokens": 1000
  }
}
```

## Batch Processing

### Analyze Multiple Videos

```http
POST /api/ai/batch
Content-Type: application/json
```

**Request Body:**
```json
{
  "requests": [
    {
      "videoId": "video_123",
      "transcript": "First video transcript...",
      "type": "summary"
    },
    {
      "videoId": "video_456",
      "transcript": "Second video transcript...",
      "type": "action-items"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "videoId": "video_123",
        "status": "completed",
        "result": { /* summary result */ }
      },
      {
        "videoId": "video_456",
        "status": "completed",
        "result": { /* action items result */ }
      }
    ],
    "summary": {
      "total": 2,
      "completed": 2,
      "failed": 0
    }
  }
}
```

## Webhooks

Subscribe to AI processing events:

```http
POST /api/ai/webhooks
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks/ai",
  "events": ["analysis.completed", "analysis.failed"]
}
```

**Webhook Events:**
- `analysis.completed`: AI analysis finished successfully
- `analysis.failed`: AI analysis failed
- `batch.completed`: Batch processing completed

## Examples

### JavaScript/TypeScript

```typescript
// Generate summary
const response = await fetch('/api/ai/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    transcript: videoTranscript,
    type: 'summary'
  })
});

const { data } = await response.json();
const summary = data.result.summary;
```

### React Hook

```typescript
import { useAI } from '@/hooks/useAI';

function VideoAnalysis({ videoId, transcript }: Props) {
  const { analyze, loading, error } = useAI();

  const handleAnalyze = async (type: 'summary' | 'action-items') => {
    const result = await analyze({
      transcript,
      type,
      videoId
    });
    
    // Handle result
    console.log(result);
  };

  return (
    <div>
      <button onClick={() => handleAnalyze('summary')}>
        Generate Summary
      </button>
      <button onClick={() => handleAnalyze('action-items')}>
        Extract Action Items
      </button>
    </div>
  );
}
```

### Python SDK

```python
import requests

def analyze_video(transcript, analysis_type):
    response = requests.post(
        'https://api.nuclom.com/ai/analyze',
        json={
            'transcript': transcript,
            'type': analysis_type
        },
        headers={'Authorization': f'Bearer {token}'}
    )
    
    return response.json()

# Usage
summary = analyze_video(transcript, 'summary')
action_items = analyze_video(transcript, 'action-items')
```

## Best Practices

1. **Transcript Quality**: Ensure high-quality transcripts for better analysis
2. **Context**: Include relevant context in transcript for better understanding
3. **Chunking**: Split large transcripts into smaller segments for better processing
4. **Caching**: Cache results to avoid redundant API calls
5. **Error Handling**: Implement robust error handling for AI service failures
6. **Rate Limiting**: Respect rate limits to avoid service interruptions

## Troubleshooting

### Common Issues

1. **Low Confidence Scores**: Check transcript quality and completeness
2. **Missing Action Items**: Ensure transcript contains clear assignments and deadlines
3. **Incorrect Summaries**: Verify transcript accuracy and context
4. **Rate Limit Errors**: Implement exponential backoff and retry logic

### Debug Mode

Enable debug mode for detailed analysis information:

```json
{
  "transcript": "...",
  "type": "summary",
  "debug": true
}
```

Debug response includes:
- Processing steps
- Model reasoning
- Confidence breakdowns
- Performance metrics
