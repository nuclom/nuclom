# Backend API Integration

This document describes the backend API integration implemented for the Nuclom video collaboration platform.

## Overview

The backend integration includes:
- Database schema and models using Prisma + PostgreSQL
- API routes for CRUD operations
- Authentication with better-auth
- AI integration with OpenAI
- File storage preparation for Cloudflare R2

## Database Schema

### Core Models
- **User**: User accounts and profiles
- **Workspace**: Team workspaces for collaboration
- **Video**: Video content with metadata
- **Channel**: Organized video channels
- **Series**: Video series/playlists
- **Comment**: Video comments and discussions
- **VideoProgress**: User viewing progress tracking

### Relationships
- Users belong to multiple workspaces
- Videos belong to workspaces, channels, and series
- Comments are threaded and belong to videos
- Progress tracking per user per video

## API Endpoints

### Videos
- `GET /api/videos` - List videos with filtering
- `GET /api/videos/[id]` - Get video with details
- `POST /api/videos` - Create new video
- `PUT /api/videos/[id]` - Update video
- `DELETE /api/videos/[id]` - Delete video

### Workspaces
- `GET /api/workspaces` - List user workspaces
- `POST /api/workspaces` - Create workspace

### Authentication
- `POST /api/auth/[...better-auth]` - Authentication endpoints
- Email/password and OAuth (GitHub, Google) support

### AI Services
- `POST /api/ai/analyze` - Generate summaries and extract action items

## Data Fetching

### React Hooks
- `useVideos()` - Fetch videos with filtering
- `useVideo(id)` - Fetch single video with details
- `useWorkspaces()` - Fetch user workspaces

### API Client
- Type-safe API client with error handling
- Automatic loading and error states
- Mock data fallback during development

## Development Setup

1. **Database Setup**
   ```bash
   # Copy environment variables
   cp .env.example .env.local
   
   # Add your database URL
   DATABASE_URL="postgresql://..."
   
   # Run Prisma migrations
   npx prisma migrate dev
   npx prisma generate
   ```

2. **Authentication Setup**
   ```bash
   # Add auth secrets to .env.local
   BETTER_AUTH_SECRET="your-secret"
   GITHUB_CLIENT_ID="..."
   GITHUB_CLIENT_SECRET="..."
   ```

3. **AI Integration**
   ```bash
   # Add OpenAI API key
   OPENAI_API_KEY="sk-..."
   ```

## Production Deployment

### Database
- Use Xata, Supabase, or PlanetScale for PostgreSQL hosting
- Set DATABASE_URL environment variable
- Run migrations: `npx prisma migrate deploy`

### File Storage
- Configure Cloudflare R2 credentials
- Update file upload endpoints to use R2

### Authentication
- Set production OAuth app credentials
- Enable email verification for production

## Migration from Mock Data

The current implementation uses mock data with a fallback mechanism:

```typescript
// Current (development)
const result = await mockVideoApi.getVideos();

// Production (when database is ready)
const result = await videoApi.getVideos({ workspaceId });
```

To migrate:
1. Set up database with Prisma migrations
2. Seed initial data
3. Update components to use `useVideos()` hook
4. Remove mock data imports

## Type Safety

All API responses and database models are fully typed:
- Prisma generates database types
- API responses use `ApiResponse<T>` wrapper
- React hooks provide typed data and loading states

## Error Handling

- API routes return standardized error responses
- Client-side hooks handle loading and error states
- Graceful fallbacks for offline/error scenarios