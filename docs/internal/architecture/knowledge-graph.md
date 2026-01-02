# Knowledge Graph for Video Decisions

This document describes the Knowledge Graph feature that automatically extracts, stores, and queries decisions made in video meetings.

## Overview

The Knowledge Graph transforms Nuclom from video storage into an organizational memory layer by:

1. **Extracting Decisions**: AI automatically identifies decisions from video transcripts
2. **Building Relationships**: Links decisions to people, topics, videos, and external artifacts
3. **Enabling Discovery**: Query decisions by topic, person, artifact, or timeline

## Architecture

### Database Schema

The knowledge graph uses five new tables:

```
decisions
├── decisionParticipants (who was involved)
├── decisionLinks (external artifact references)
└── knowledgeNodes/knowledgeEdges (graph structure)
```

#### decisions

Core decision records with:
- `summary`: Brief decision summary
- `context`: Background context
- `reasoning`: Why this decision was made
- `status`: proposed | decided | revisited | superseded
- `decisionType`: technical | process | product | team | other
- `timestampStart/End`: Video timestamp range
- `confidence`: AI confidence score (0-100)
- `tags`: Array of topic tags
- `embedding`: Vector embedding for semantic search (future)

#### decisionParticipants

People involved in decisions:
- `role`: decider | participant | mentioned
- References user table when available, stores name otherwise

#### knowledgeNodes

Graph nodes for:
- `person`: Team members
- `topic`: Discussion topics/themes
- `artifact`: External references (PRs, docs, issues)
- `decision`: Decisions themselves
- `video`: Video recordings

#### knowledgeEdges

Relationships between nodes:
- `relationshipType`: Examples: "made_by", "discussed_in", "related_to", "mentions"
- `weight`: Relationship strength (optional)

#### decisionLinks

Polymorphic links to external artifacts:
- `artifactType`: github:pr, github:issue, google:doc, notion:page, jira:issue
- `artifactId`: External identifier
- `url`: Direct link to artifact

### AI Decision Extraction

The `DecisionExtractionService` uses AI to extract decisions from transcripts:

```typescript
import { DecisionExtractionService } from "@/lib/effect";

const decisions = await DecisionExtractionService.extractDecisions(
  transcriptSegments,
  videoTitle
);
```

Extraction includes:
- Decision summary and type classification
- Participant identification with roles
- Topic/tag extraction
- Timestamp mapping to transcript segments
- Confidence scoring
- External artifact detection (GitHub PR mentions, etc.)

### Video Processing Integration

Decision extraction is integrated into the video processing workflow:

```typescript
// In video-processing.ts workflow

// Step 7: Extract decisions
const decisions = await extractDecisions(transcription.segments, videoTitle);

// Step 8: Save to database
await saveDecisions(videoId, organizationId, decisions);
```

## API Endpoints

### Decision Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge/decisions` | GET | List decisions with filters |
| `/api/knowledge/decisions` | POST | Create manual decision |
| `/api/knowledge/decisions/[id]` | GET | Get single decision |
| `/api/knowledge/decisions/[id]` | PUT | Update decision |
| `/api/knowledge/decisions/[id]` | DELETE | Delete decision |

Query parameters for listing:
- `organizationId` (required)
- `videoId`, `status`, `type`, `topic`, `person`, `search`

### Timeline Endpoint

```
GET /api/knowledge/timeline?organizationId=xxx&startDate=xxx&endDate=xxx
```

Returns chronologically ordered decisions within a date range.

### Context Endpoint

```
GET /api/knowledge/context?organizationId=xxx&artifactType=github:pr&artifactId=123
```

Returns all decisions linked to a specific external artifact.

### Graph Endpoint

```
GET /api/knowledge/graph?organizationId=xxx
```

Returns knowledge graph nodes and edges for visualization.

### Video Decisions Endpoint

```
GET /api/videos/[id]/decisions
```

Returns all decisions extracted from a specific video.

## UI Components

### DecisionTimeline

Chronological timeline showing decisions across videos:
- Filter by type and status
- Expandable cards with full context
- Direct video links with timestamp

### KnowledgeExplorer

Interactive force-directed graph visualization:
- Node types: person, topic, decision, video, artifact
- Click to explore connected nodes
- Search and filter capabilities
- Zoom and fullscreen support

### VideoDecisionsSidebar

Sidebar panel for video detail page:
- Shows decisions sorted by timestamp
- Highlights active decision during playback
- Click to seek video to decision point
- Expandable details (reasoning, context, participants)

## Usage

### Viewing Decisions on Videos

1. Navigate to any video page
2. Click the "Decisions" tab in the sidebar
3. Click a decision to seek to that point in the video

### Browsing the Knowledge Graph

1. Navigate to the Knowledge Explorer page
2. Use search/filter to find specific nodes
3. Click nodes to see connections and details

### Querying Decisions

Use the timeline view to find decisions by:
- Date range
- Topic or keyword
- Decision type
- Status

## Data Flow

```
Video Upload
    ↓
Transcription (Step 3)
    ↓
AI Analysis (Step 6)
    ↓
Decision Extraction (Step 7)  ← DecisionExtractionService
    ↓
Database Storage (Step 8)     ← KnowledgeGraphRepository
    ↓
API Endpoints                 ← /api/knowledge/*
    ↓
UI Components                 ← Timeline, Explorer, Sidebar
```

## Configuration

The AI model used for decision extraction is configurable:
- Default: `xai/grok-3` via AI Gateway
- Configurable via environment or service layer

## Future Enhancements

Planned improvements:
- Vector embeddings for semantic search
- Cross-video decision linking
- Decision impact tracking
- Integration with project management tools
- Automated decision follow-up reminders
- Decision conflict detection

## Troubleshooting

### Decisions not appearing

1. Check video processing completed successfully
2. Verify transcript was generated
3. Check the video has sufficient spoken content

### Low confidence scores

- May indicate unclear discussion in the video
- Consider adding manual decisions for important items

### Missing participants

- Participants are extracted from transcript text
- Names must be mentioned explicitly in discussion

## Related Documentation

- [Video Processing](./video-processing.md)
- [Database Schema](./database.md)
- [API Reference](/docs/public/api/)
