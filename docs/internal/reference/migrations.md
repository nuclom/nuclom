# Database Migration Strategy

This document outlines the production migration strategy for Nuclom, including rollback procedures and zero-downtime deployment practices.

## Migration Files

### Location

```
drizzle/
├── 0000_init.sql                      # Initial schema
├── 0001_add_video_processing.sql      # Video processing fields
├── 0002_add_integrations.sql          # Zoom/Google Meet integrations
├── 0002_add_series_tables.sql         # Series/collections functionality
└── rollbacks/
    ├── 0000_rollback_init.sql
    ├── 0001_rollback_add_video_processing.sql
    ├── 0002_rollback_add_integrations.sql
    └── 0002_rollback_add_series_tables.sql
```

## Production Migration Workflow

### Pre-Migration Checklist

1. **Backup the database**
   ```bash
   pg_dump $DATABASE_URL | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz
   ```

2. **Test migration on staging**
   ```bash
   # Restore production backup to staging
   gunzip -c backup.sql.gz | psql $STAGING_DATABASE_URL

   # Run migrations on staging
   NODE_ENV=staging pnpm db:migrate

   # Test application functionality
   ```

3. **Review migration SQL**
   - Check for destructive operations (DROP, DELETE, TRUNCATE)
   - Verify foreign key constraints
   - Check for long-running operations on large tables

4. **Schedule maintenance window** (if needed)
   - For destructive migrations only
   - Notify users in advance
   - Plan for rollback

### Migration Execution

```bash
# 1. Enable maintenance mode (optional)
# Set MAINTENANCE_MODE=true in environment

# 2. Run migrations
NODE_ENV=production pnpm db:migrate

# 3. Verify migration success
pnpm db:studio  # Check schema visually

# 4. Disable maintenance mode
# Set MAINTENANCE_MODE=false
```

## Zero-Downtime Migration Patterns

### Pattern 1: Additive Changes (Safe)

Adding new columns, tables, or indexes that don't affect existing queries.

```sql
-- Safe: Adding nullable column
ALTER TABLE videos ADD COLUMN new_field text;

-- Safe: Adding new table
CREATE TABLE new_feature (...);

-- Safe: Adding index (use CONCURRENTLY in production)
CREATE INDEX CONCURRENTLY idx_name ON table(column);
```

**Deployment Order:**
1. Deploy migration
2. Deploy application code

### Pattern 2: Column Rename (Expand-Contract)

Renaming columns requires a multi-phase approach.

**Phase 1: Expand**
```sql
-- Add new column
ALTER TABLE videos ADD COLUMN new_name text;

-- Backfill data
UPDATE videos SET new_name = old_name;
```

**Phase 2: Dual-Write (Application)**
```typescript
// Write to both columns
await db.update(videos).set({
  old_name: value,
  new_name: value,
});
```

**Phase 3: Switch Reads**
```typescript
// Read from new column
const result = await db.select({ name: videos.new_name }).from(videos);
```

**Phase 4: Contract**
```sql
-- Remove old column
ALTER TABLE videos DROP COLUMN old_name;
```

### Pattern 3: Column Type Change

Changing column types without downtime.

**Example: text to jsonb**

```sql
-- Phase 1: Add new column
ALTER TABLE videos ADD COLUMN metadata_new jsonb;

-- Phase 2: Backfill (batch for large tables)
UPDATE videos
SET metadata_new = metadata::jsonb
WHERE id IN (SELECT id FROM videos WHERE metadata_new IS NULL LIMIT 1000);

-- Phase 3: Switch application to new column
-- Phase 4: Drop old column
ALTER TABLE videos DROP COLUMN metadata;
ALTER TABLE videos RENAME COLUMN metadata_new TO metadata;
```

### Pattern 4: Adding NOT NULL Constraint

```sql
-- Phase 1: Add with default
ALTER TABLE videos ADD COLUMN status text DEFAULT 'active';

-- Phase 2: Backfill existing rows
UPDATE videos SET status = 'active' WHERE status IS NULL;

-- Phase 3: Add NOT NULL constraint
ALTER TABLE videos ALTER COLUMN status SET NOT NULL;
```

### Pattern 5: Adding Foreign Key

```sql
-- Phase 1: Add column without constraint
ALTER TABLE videos ADD COLUMN new_fk_id text;

-- Phase 2: Backfill valid values

-- Phase 3: Add constraint (with validation)
ALTER TABLE videos
ADD CONSTRAINT videos_new_fk_id_fk
FOREIGN KEY (new_fk_id) REFERENCES other_table(id)
NOT VALID;

-- Phase 4: Validate constraint (can be slow on large tables)
ALTER TABLE videos VALIDATE CONSTRAINT videos_new_fk_id_fk;
```

## Rollback Procedures

### Immediate Rollback

If a migration fails or causes issues, execute the corresponding rollback script:

```bash
# Example: Rollback integrations migration
psql $DATABASE_URL < drizzle/rollbacks/0002_rollback_add_integrations.sql
```

### Rollback Sequence

Rollbacks must be executed in reverse order:

```bash
# Latest to earliest
psql $DATABASE_URL < drizzle/rollbacks/0002_rollback_add_series_tables.sql
psql $DATABASE_URL < drizzle/rollbacks/0002_rollback_add_integrations.sql
psql $DATABASE_URL < drizzle/rollbacks/0001_rollback_add_video_processing.sql
# psql $DATABASE_URL < drizzle/rollbacks/0000_rollback_init.sql  # DANGER: Drops everything
```

### Rollback Verification

After rollback:

1. Check schema state:
   ```sql
   \dt  -- List tables
   \d videos  -- Describe specific table
   ```

2. Test application functionality

3. Review application logs for errors

## Large Table Migrations

For tables with millions of rows, use batch operations:

### Batch Update Pattern

```sql
-- Create function for batch updates
CREATE OR REPLACE FUNCTION batch_update_videos()
RETURNS void AS $$
DECLARE
  batch_size INTEGER := 10000;
  updated INTEGER;
BEGIN
  LOOP
    UPDATE videos
    SET new_column = compute_value()
    WHERE id IN (
      SELECT id FROM videos
      WHERE new_column IS NULL
      LIMIT batch_size
      FOR UPDATE SKIP LOCKED
    );

    GET DIAGNOSTICS updated = ROW_COUNT;
    EXIT WHEN updated = 0;

    COMMIT;
    PERFORM pg_sleep(0.1);  -- Brief pause to reduce load
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Execute
SELECT batch_update_videos();
```

### Index Creation

Always use CONCURRENTLY for production indexes:

```sql
-- This doesn't lock the table
CREATE INDEX CONCURRENTLY idx_videos_processing_status
ON videos(processing_status);
```

## Monitoring Migrations

### During Migration

```sql
-- Check active queries
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '1 minute';

-- Check lock waits
SELECT blocked_locks.pid AS blocked_pid,
       blocking_locks.pid AS blocking_pid,
       blocked_activity.query AS blocked_query
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_locks blocking_locks ON blocked_locks.locktype = blocking_locks.locktype
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_locks.pid = blocked_activity.pid
WHERE NOT blocked_locks.granted;
```

### Post-Migration

```sql
-- Verify table structure
\d+ videos

-- Check foreign key constraints
SELECT conname, conrelid::regclass, confrelid::regclass
FROM pg_constraint
WHERE contype = 'f';

-- Verify indexes
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'videos';
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: pnpm install

      - name: Backup database
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          pg_dump $DATABASE_URL | gzip > backup.sql.gz
          # Upload to S3/GCS for safe storage

      - name: Run migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: pnpm db:migrate

      - name: Verify migrations
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          # Run schema validation
          pnpm db:push --dry-run
```

## Best Practices

1. **Always backup before migrations**
2. **Test on staging first**
3. **Use transactions where possible**
4. **Add indexes CONCURRENTLY**
5. **Batch large data operations**
6. **Monitor during and after migrations**
7. **Keep rollback scripts up to date**
8. **Document breaking changes**

## Vercel Deployment Considerations

When deploying to Vercel:

1. **Build-time migrations are not recommended**
   - Migrations should run separately from builds
   - Use GitHub Actions or manual process

2. **Connection limits**
   - Vercel serverless functions have limited connections
   - Use connection pooling (e.g., PgBouncer, Supabase pooler)

3. **Timeout constraints**
   - Vercel functions have 10s (hobby) / 60s (pro) timeouts
   - Long migrations should run from a dedicated server

## Emergency Procedures

### Complete Rollback

If all else fails, restore from backup:

```bash
# 1. Stop application (enable maintenance mode)

# 2. Drop and recreate database
psql -U postgres -c "DROP DATABASE nuclom;"
psql -U postgres -c "CREATE DATABASE nuclom;"

# 3. Restore from backup
gunzip -c backup.sql.gz | psql $DATABASE_URL

# 4. Restart application
```

### Partial Data Recovery

For recovering specific tables:

```bash
# Restore single table from backup
pg_restore --table=videos -d nuclom backup.dump
```
