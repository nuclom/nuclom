# Development Setup

> **Time to complete:** 5-10 minutes
>
> Get your local development environment running.

---

## Prerequisites

Before you begin, install:

| Requirement | Version | Check with |
| ----------- | ------- | ---------- |
| Node.js | 18.x+ | `node --version` |
| pnpm | 8.x+ | `pnpm --version` |
| PostgreSQL | 14.x+ | `psql --version` |
| Git | Latest | `git --version` |

---

## Quick Setup

```bash
# 1. Clone the repository
git clone https://github.com/SferaDev/nuclom.git
cd nuclom

# 2. Install dependencies
pnpm install

# 3. Set up environment
cp .env.example .env.local

# 4. Run database migrations
pnpm db:migrate

# 5. Start development server
pnpm dev
```

Open [http://localhost:5001](http://localhost:5001) — you're ready to go.

---

## Step-by-Step Setup

### 1. Clone the Repository

```bash
git clone https://github.com/SferaDev/nuclom.git
cd nuclom
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Configure Environment

Copy the template:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values. See [Environment Configuration](environment-config.md) for details.

**Required variables:**

| Variable | Description |
| -------- | ----------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Auth encryption key (generate random string) |

### 4. Set Up Database

```bash
# Generate schema types
pnpm db:generate

# Run migrations
pnpm db:migrate

# (Optional) Open database GUI
pnpm db:studio
```

See [Database Setup](database-setup.md) for detailed instructions.

### 5. Start Development Server

```bash
pnpm dev
```

The app runs at [http://localhost:5001](http://localhost:5001).

---

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/            # Main app routes
│   │   └── [organization]/ # Organization-scoped routes
│   │       ├── channels/  # Channel pages
│   │       ├── series/    # Series pages
│   │       ├── videos/    # Video pages
│   │       ├── search/    # Search
│   │       └── settings/  # Organization settings
│   └── api/               # API endpoints
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── *.tsx             # Feature components
├── hooks/                # Custom React hooks
├── lib/                  # Core utilities
│   ├── db/              # Database schema & connection
│   ├── auth.ts          # Auth configuration
│   ├── api.ts           # API client
│   └── utils.ts         # Utilities
└── types/                # TypeScript types
```

---

## Common Tasks

### Adding a Component

```typescript
// src/components/my-component.tsx
import { cn } from "@/lib/utils"

interface Props {
  readonly children: React.ReactNode
  readonly className?: string
}

export function MyComponent({ children, className }: Props) {
  return (
    <div className={cn("base-styles", className)}>
      {children}
    </div>
  )
}
```

### Adding an API Endpoint

```typescript
// src/app/api/my-endpoint/route.ts
import { connection, NextResponse, type NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  await connection()  // Required for database access

  try {
    const result = await db.query.myTable.findMany()
    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    )
  }
}
```

### Adding a Database Table

```typescript
// src/lib/db/schema.ts
export const myTable = pgTable("my_table", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type MyModel = typeof myTable.$inferSelect
export type NewMyModel = typeof myTable.$inferInsert
```

Then run:

```bash
pnpm db:generate
pnpm db:migrate
```

---

## Code Quality

### Before Committing

```bash
pnpm tsc        # Type check
pnpm lint       # Lint
pnpm format     # Format
```

### Import Aliases

Use the `@/` prefix for imports:

```typescript
import { Button } from "@/components/ui/button"
import { useVideos } from "@/hooks/use-api"
import { cn } from "@/lib/utils"
import type { Video } from "@/lib/types"
```

---

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection
psql $DATABASE_URL
```

### Node Version Issues

```bash
# Check version
node --version

# Use nvm to switch
nvm use 18
```

### Dependency Issues

```bash
# Clear cache and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm store prune
pnpm install
```

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Type check first
pnpm tsc

# Then build
pnpm build
```

### Debug Mode

```bash
# Enable debug logging
DEBUG=* pnpm dev

# Or specific namespaces
DEBUG=nuclom:* pnpm dev
```

---

## Next Steps

| Topic | Guide |
| ----- | ----- |
| Environment variables | [Environment Configuration](environment-config.md) |
| Database setup | [Database Setup](database-setup.md) |
| Component library | [Components](components.md) |
| Styling | [Styling Guide](styling.md) |
| Testing | [Testing Guide](testing.md) |
| Architecture | [Architecture Overview](../architecture/README.md) |
