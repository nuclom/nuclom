# Database Setup

This guide covers setting up and managing the PostgreSQL database for Nuclom using Drizzle ORM.

## Overview

Nuclom uses:

- **PostgreSQL** as the primary database
- **Drizzle ORM** for database operations and migrations
- **Drizzle Kit** for schema generation and migrations

## Database Schema

### Core Tables

#### Users

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Organizations

```sql
CREATE TABLE organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Videos

```sql
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration TEXT NOT NULL,
  thumbnail_url TEXT,
  video_url TEXT,
  author_id TEXT REFERENCES users(id),
  organization_id TEXT REFERENCES organizations(id),
  channel_id TEXT REFERENCES channels(id),
  series_id TEXT REFERENCES series(id),
  transcript TEXT,
  ai_summary TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

See [schema.ts](../../../src/lib/db/schema.ts) for complete schema definition.

## Quick Setup

### 1. Install PostgreSQL

#### macOS

```bash
brew install postgresql
brew services start postgresql
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### Windows

Download and install from [PostgreSQL.org](https://www.postgresql.org/download/windows/)

### 2. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE nuclom;

# Create user (optional)
CREATE USER nuclom_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE nuclom TO nuclom_user;
```

### 3. Set Environment Variable

```bash
# Add to .env.local
DATABASE_URL="postgresql://postgres:password@localhost:5432/nuclom"
```

### 4. Generate Schema and Migrate

```bash
# Generate Drizzle schema
pnpm db:generate

# Run migrations
pnpm db:migrate
```

## Drizzle Commands

### Schema Generation

```bash
# Generate new migration based on schema changes
pnpm db:generate

# Generate with custom name
pnpm db:generate --name "add_user_roles"
```

### Database Migrations

```bash
# Run all pending migrations
pnpm db:migrate

# Push schema directly (development only)
pnpm db:push
```

### Database Studio

```bash
# Open Drizzle Studio
pnpm db:studio
```

This opens a web interface at `http://localhost:4983` to browse your database.

## Database Operations

### Connection

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;
const client = postgres(connectionString);
export const db = drizzle(client);
```

### Query Examples

#### Create Operations

```typescript
import { db } from "@/lib/db";
import { users, organizations } from "@/lib/db/schema";

// Create user
const newUser = await db
  .insert(users)
  .values({
    email: "user@example.com",
    name: "John Doe",
  })
  .returning();

// Create organization
const newOrganization = await db
  .insert(organizations)
  .values({
    name: "My Organization",
    slug: "my-organization",
    description: "Team collaboration space",
  })
  .returning();
```

#### Read Operations

```typescript
import { eq, and, desc } from "drizzle-orm";

// Get user by email
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, "user@example.com"))
  .limit(1);

// Get organization videos with author
const videos = await db
  .select({
    id: videos.id,
    title: videos.title,
    authorName: users.name,
  })
  .from(videos)
  .innerJoin(users, eq(videos.authorId, users.id))
  .where(eq(videos.organizationId, organizationId))
  .orderBy(desc(videos.createdAt));
```

#### Update Operations

```typescript
// Update user profile
await db
  .update(users)
  .set({ name: "Updated Name" })
  .where(eq(users.id, userId));

// Update video details
await db
  .update(videos)
  .set({
    title: "New Title",
    description: "Updated description",
    updatedAt: new Date(),
  })
  .where(eq(videos.id, videoId));
```

#### Delete Operations

```typescript
// Delete video
await db.delete(videos).where(eq(videos.id, videoId));

// Delete user and cascade
await db.delete(users).where(eq(users.id, userId));
```

### Relations and Joins

```typescript
// Get video with all related data
const videoWithDetails = await db.query.videos.findFirst({
  where: eq(videos.id, videoId),
  with: {
    author: true,
    organization: true,
    channel: true,
    series: true,
    comments: {
      with: {
        author: true,
      },
    },
  },
});
```

## Migrations

### Creating Migrations

1. **Modify schema** in `src/lib/db/schema.ts`
2. **Generate migration**: `pnpm db:generate`
3. **Review migration** in `drizzle/` directory
4. **Apply migration**: `pnpm db:migrate`

### Example Migration

```typescript
// drizzle/0001_add_video_tags.sql
CREATE TABLE video_tags (
  id TEXT PRIMARY KEY,
  video_id TEXT REFERENCES videos(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_video_tags_video_id ON video_tags(video_id);
CREATE INDEX idx_video_tags_tag ON video_tags(tag);
```

### Migration Best Practices

1. **Review generated migrations** before applying
2. **Test migrations** on development data
3. **Backup production** before running migrations
4. **Run migrations** during low-traffic periods
5. **Monitor** application after migrations

## Seeding Data

### Development Seed

```typescript
// scripts/seed.ts
import { db } from "@/lib/db";
import { users, organizations, videos } from "@/lib/db/schema";

async function seed() {
  // Create test user
  const [user] = await db
    .insert(users)
    .values({
      email: "admin@example.com",
      name: "Admin User",
    })
    .returning();

  // Create test organization
  const [organization] = await db
    .insert(organizations)
    .values({
      name: "Demo Organization",
      slug: "demo",
      description: "Demo organization for testing",
    })
    .returning();

  // Create test videos
  await db.insert(videos).values([
    {
      title: "Welcome Video",
      description: "Introduction to the platform",
      duration: "5:30",
      authorId: user.id,
      organizationId: organization.id,
    },
    {
      title: "Tutorial Video",
      description: "How to use the platform",
      duration: "12:45",
      authorId: user.id,
      organizationId: organization.id,
    },
  ]);
}

seed().catch(console.error);
```

Run seed script:

```bash
tsx scripts/seed.ts
```

## Database Hosting

### Local Development

```bash
# PostgreSQL with Docker
docker run --name nuclom-db \
  -e POSTGRES_DB=nuclom \
  -e POSTGRES_USER=nuclom \
  -e POSTGRES_PASSWORD=password \
  -p 5432:5432 \
  -d postgres:15

# Connection string
DATABASE_URL="postgresql://nuclom:password@localhost:5432/nuclom"
```

### Production Hosting

#### Railway

1. Create new PostgreSQL database
2. Copy connection string from dashboard
3. Set `DATABASE_URL` in environment variables

#### Supabase

1. Create new project
2. Go to Settings → Database
3. Copy connection string
4. Use connection pooling for production

#### PlanetScale

1. Create new database
2. Create connection string
3. Enable foreign key constraints if needed

#### AWS RDS

1. Create PostgreSQL RDS instance
2. Configure security groups
3. Use connection string with SSL

## Performance Optimization

### Indexes

```sql
-- Common indexes for video queries
CREATE INDEX idx_videos_organization_id ON videos(organization_id);
CREATE INDEX idx_videos_author_id ON videos(author_id);
CREATE INDEX idx_videos_created_at ON videos(created_at);
CREATE INDEX idx_videos_channel_id ON videos(channel_id);
CREATE INDEX idx_videos_series_id ON videos(series_id);

-- Composite indexes for common queries
CREATE INDEX idx_videos_organization_created ON videos(organization_id, created_at DESC);
```

### Query Optimization

```typescript
// Use select specific fields
const videos = await db
  .select({
    id: videos.id,
    title: videos.title,
    thumbnailUrl: videos.thumbnailUrl,
  })
  .from(videos)
  .where(eq(videos.organizationId, organizationId))
  .limit(20);

// Use pagination
const videos = await db
  .select()
  .from(videos)
  .where(eq(videos.organizationId, organizationId))
  .offset(page * limit)
  .limit(limit);
```

### Connection Pooling

```typescript
// src/lib/db/index.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, {
  max: 20, // Maximum connections
  idle_timeout: 30, // Idle timeout in seconds
  max_lifetime: 300, // Maximum connection lifetime
});

export const db = drizzle(client);
```

## Backup and Recovery

### Backup Commands

```bash
# Full database backup
pg_dump $DATABASE_URL > backup.sql

# Schema-only backup
pg_dump --schema-only $DATABASE_URL > schema.sql

# Data-only backup
pg_dump --data-only $DATABASE_URL > data.sql

# Compressed backup
pg_dump $DATABASE_URL | gzip > backup.sql.gz
```

### Restore Commands

```bash
# Restore from backup
psql $DATABASE_URL < backup.sql

# Restore compressed backup
gunzip -c backup.sql.gz | psql $DATABASE_URL
```

### Automated Backups

```bash
#!/bin/bash
# scripts/backup.sh

BACKUP_DIR="/path/to/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/nuclom_backup_$TIMESTAMP.sql.gz"

# Create backup
pg_dump $DATABASE_URL | gzip > "$BACKUP_FILE"

# Keep only last 7 days of backups
find "$BACKUP_DIR" -name "nuclom_backup_*.sql.gz" -mtime +7 -delete

echo "Backup created: $BACKUP_FILE"
```

## Monitoring

### Database Monitoring

```sql
-- Check database size
SELECT pg_database_size('nuclom') / 1024 / 1024 AS size_mb;

-- Check table sizes
SELECT
  schemaname,
  tablename,
  pg_total_relation_size(schemaname||'.'||tablename) / 1024 / 1024 AS size_mb
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_mb DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Application Monitoring

```typescript
// Monitor query performance
const start = performance.now();
const result = await db.select().from(videos);
const duration = performance.now() - start;

console.log(`Query took ${duration.toFixed(2)}ms`);
```

## Troubleshooting

### Common Issues

#### Connection Refused

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connection string
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL
```

#### Migration Failures

```bash
# Check migration status
ls -la drizzle/

# Reset migrations (development only)
rm -rf drizzle/
pnpm db:generate
pnpm db:push
```

#### Schema Sync Issues

```bash
# Force push schema (development only)
pnpm db:push --force

# Generate new migration
pnpm db:generate
```

### Debug Queries

```typescript
// Enable query logging
import { drizzle } from "drizzle-orm/postgres-js";

const db = drizzle(client, {
  logger: true, // Enable query logging
});
```

## Next Steps

- [Learn about the API layer](../api/)
- [Understand the component architecture](./components.md)
- [Set up authentication](./environment-config.md#authentication)
- [Configure file storage](./environment-config.md#file-storage)
