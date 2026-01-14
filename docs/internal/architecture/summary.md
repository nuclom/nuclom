# Architecture Summary

> Quick reference for the Nuclom platform architecture.

---

## Tech Stack

| Layer | Technologies |
| ----- | ------------ |
| **Frontend** | Next.js 16, React 19, TypeScript, Tailwind CSS |
| **UI** | shadcn/ui, Radix UI, Lucide Icons |
| **Backend** | Next.js API Routes, Effect-TS |
| **Database** | PostgreSQL, Drizzle ORM |
| **Auth** | Better-Auth (GitHub, Google OAuth) |
| **Storage** | Cloudflare R2 |
| **AI** | OpenAI, Vercel AI SDK |
| **Deployment** | Vercel with CI/CD |

---

## Key Decisions

### 1. Next.js 16 with App Router

**Why:** Server Components for performance, built-in API routes, excellent TypeScript support, seamless Vercel deployment.

### 2. PostgreSQL + Drizzle ORM

**Why:** Relational model fits collaboration data, type-safe queries, mature tooling, excellent read performance.

### 3. Better-Auth (not NextAuth)

**Why:** Better TypeScript support, more flexible configuration, built-in session management.

### 4. Cloudflare R2

**Why:** Cost-effective storage, global CDN, S3-compatible API, excellent video streaming performance.

### 5. Organization-based Multi-tenancy

**Why:** Clean data separation, scalable permissions, URL-based routing.

---

## Core Features

| Feature | Description |
| ------- | ----------- |
| **Multi-organization** | Separate workspaces with role-based permissions |
| **Video collaboration** | Upload, stream, comment with timestamps |
| **AI insights** | Summaries, transcripts, action items |
| **Knowledge graph** | Decision extraction and relationships |
| **Real-time presence** | See who's watching |
| **Recommendations** | Personalized video suggestions |

---

## Database Tables

### Core

| Table | Purpose |
| ----- | ------- |
| `users` | User accounts |
| `organizations` | Team workspaces |
| `members` | Organization membership |
| `videos` | Video metadata |
| `comments` | Time-stamped discussions |
| `channels` | Video grouping by topic |
| `series` | Sequential video groups |

### Engagement

| Table | Purpose |
| ----- | ------- |
| `comment_reactions` | Emoji reactions |
| `watch_history` | Progress tracking |
| `watch_later` | Bookmarks |
| `notifications` | User alerts |

### Knowledge

| Table | Purpose |
| ----- | ------- |
| `decisions` | Extracted decisions |
| `knowledge_nodes` | Graph nodes |
| `knowledge_edges` | Relationships |

---

## Architecture Patterns

### Frontend

```typescript
// Server Components by default
export default async function Page() {
  const data = await fetchData()
  return <Component data={data} />
}

// Client Components when needed
"use client"
export function Interactive() {
  const [state, setState] = useState()
  // ...
}
```

### API Routes

```typescript
// Always call connection() for database access
export async function GET(request: NextRequest) {
  await connection()

  const result = await Effect.runPromise(
    Effect.tryPromise(() => db.query.videos.findMany())
  )

  return NextResponse.json({ success: true, data: result })
}
```

### Database

```typescript
// Drizzle query builder
const video = await db.query.videos.findFirst({
  where: eq(videos.id, id),
  with: { author: true, comments: true }
})

// Type-safe inserts
await db.insert(videos).values({ title, authorId })
```

---

## Performance

### Frontend

- Server-side rendering
- Route-based code splitting
- Image optimization
- Static generation where possible

### Backend

- Indexed database queries
- Connection pooling
- CDN for video delivery
- Edge-optimized API

---

## Security

| Area | Implementation |
| ---- | -------------- |
| **Auth** | OAuth 2.0, session cookies, CSRF protection |
| **Authz** | Role-based access (Owner, Admin, Member) |
| **Data** | Input validation, SQL injection prevention |
| **Infra** | HTTPS, env var management |

---

## Recent Additions (v2.0)

- Knowledge graph with decision extraction
- Structured AI outputs (Effect Schema)
- Video recommendations
- Continue watching / Watch later
- Comment reactions (8 types)
- User presence indicators
- Performance monitoring

---

## Documentation

| Topic | Document |
| ----- | -------- |
| Full architecture | [README.md](README.md) |
| Database schema | [database.md](database.md) |
| Frontend patterns | [frontend.md](frontend.md) |
| Backend patterns | [backend.md](backend.md) |
| Authentication | [authentication.md](authentication.md) |
| Video processing | [video-processing.md](video-processing.md) |
| Effect-TS | [effect-ts.md](effect-ts.md) |
| Deployment | [deployment.md](deployment.md) |
