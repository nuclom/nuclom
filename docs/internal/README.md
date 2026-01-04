# Internal Documentation

> Developer and contributor documentation for the Nuclom codebase.

---

## Quick Start

Get running in 5 minutes:

```bash
git clone https://github.com/SferaDev/nuclom.git
cd nuclom
pnpm install
cp .env.example .env.local  # Configure your environment
pnpm db:migrate
pnpm dev                    # → http://localhost:3000
```

**Detailed setup:** [Development Setup](reference/development-setup.md)

---

## Documentation Index

### Development Reference

| Guide | Description |
| ----- | ----------- |
| [Development Setup](reference/development-setup.md) | Environment setup and installation |
| [Environment Config](reference/environment-config.md) | Environment variables |
| [Database Setup](reference/database-setup.md) | PostgreSQL and migrations |
| [Components](reference/components.md) | UI component library |
| [Hooks](reference/hooks.md) | Custom React hooks |
| [Styling](reference/styling.md) | Tailwind CSS and themes |
| [Testing](reference/testing.md) | Vitest and Playwright |
| [Contributing](reference/contributing.md) | Code standards and workflow |

### Architecture

| Guide | Description |
| ----- | ----------- |
| [Overview](architecture/README.md) | High-level system design |
| [Summary](architecture/summary.md) | Quick technical reference |
| [Database](architecture/database.md) | Schema and relationships |
| [Frontend](architecture/frontend.md) | Next.js and React patterns |
| [Backend](architecture/backend.md) | API design |
| [Authentication](architecture/authentication.md) | Better-Auth implementation |
| [Video Processing](architecture/video-processing.md) | Upload and streaming |
| [Effect-TS](architecture/effect-ts.md) | Error handling patterns |
| [Deployment](architecture/deployment.md) | Infrastructure and CI/CD |

---

## Tech Stack

| Layer | Technologies |
| ----- | ------------ |
| **Frontend** | Next.js 16, React 19, TypeScript |
| **Styling** | Tailwind CSS, shadcn/ui, Radix UI |
| **Backend** | Next.js API Routes, Effect-TS |
| **Database** | PostgreSQL, Drizzle ORM |
| **Auth** | Better-Auth (OAuth: GitHub, Google) |
| **Storage** | Cloudflare R2 |
| **AI** | OpenAI, Vercel AI SDK |
| **Testing** | Vitest, Playwright |
| **Build** | pnpm, Biome (lint/format) |

---

## Common Commands

### Development

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm start            # Start production server
```

### Code Quality

```bash
pnpm tsc              # Type check
pnpm lint             # Lint with Biome
pnpm format           # Format with Biome
```

### Database

```bash
pnpm db:generate      # Generate migration
pnpm db:migrate       # Run migrations
pnpm db:push          # Push schema (dev only)
pnpm db:studio        # Open Drizzle Studio
```

### Testing

```bash
pnpm test             # Unit tests (Vitest)
pnpm test:e2e         # E2E tests (Playwright)
pnpm test:coverage    # Coverage report
```

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/            # Main app routes
│   │   └── [organization]/ # Organization-scoped pages
│   ├── api/               # API endpoints
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── *.tsx             # Feature components
├── hooks/                # Custom React hooks
├── lib/                  # Core utilities
│   ├── db/              # Database schema & connection
│   ├── auth.ts          # Auth configuration
│   └── utils.ts         # Utilities
└── types/                # TypeScript types
```

---

## Key Patterns

### API Routes

```typescript
// Always call connection() first
import { connection } from "next/server"

export async function GET(request: NextRequest) {
  await connection()  // Required for database access
  // ... handler logic
}
```

### Database Queries

```typescript
// Use Drizzle query builder
const video = await db.query.videos.findFirst({
  where: eq(videos.id, videoId),
  with: { user: true, comments: true }
})
```

### Components

```typescript
// Use cn() for conditional classes
import { cn } from "@/lib/utils"

<div className={cn("base-styles", isActive && "active-styles")} />
```

---

## Contributing

1. Read [Contributing Guidelines](reference/contributing.md)
2. Set up [Development Environment](reference/development-setup.md)
3. Understand [System Architecture](architecture/README.md)
4. Follow established code patterns

---

**Need help?** Check [Troubleshooting](../public/guides/troubleshooting.md) or reach out to the team.
