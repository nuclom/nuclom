# Deployment Architecture

Nuclom is designed for cloud-native deployment with a focus on scalability, reliability, and performance. This document outlines the deployment strategy and infrastructure requirements.

## Deployment Overview

```mermaid
graph TB
    subgraph "CDN/Edge"
        A[Cloudflare CDN]
        B[Edge Functions]
        C[Static Assets]
    end

    subgraph "Application Layer"
        D[Vercel Platform]
        E[Next.js Application]
        F[API Routes]
        G[Server Functions]
    end

    subgraph "Database Layer"
        H[PostgreSQL Primary]
        I[PostgreSQL Replica]
        J[Connection Pool]
    end

    subgraph "Storage Layer"
        K[Cloudflare R2]
        L[Video Files]
        M[Thumbnails]
        N[Transcripts]
    end

    subgraph "External Services"
        O[GitHub OAuth]
        P[Google OAuth]
        Q[OpenAI API]
    end

    A --> D
    B --> E
    C --> A
    D --> E
    E --> F
    F --> G
    G --> J
    J --> H
    J --> I
    E --> K
    K --> L
    K --> M
    K --> N
    F --> O
    F --> P
    F --> Q
```

## Infrastructure Components

### 1. Application Platform (Vercel)

- **Hosting**: Vercel provides serverless deployment for Next.js applications
- **Edge Functions**: Global edge network for low-latency responses
- **Automatic Scaling**: Auto-scaling based on demand
- **CI/CD**: Integrated continuous deployment from Git

### 2. Database (PostgreSQL)

- **Primary Database**: PostgreSQL instance for read/write operations
- **Read Replicas**: Optional read replicas for scaling read operations
- **Connection Pooling**: PgBouncer or similar for connection management
- **Backup Strategy**: Automated backups with point-in-time recovery

### 3. File Storage (Cloudflare R2)

- **Object Storage**: Cloudflare R2 for video files and assets
- **CDN Integration**: Global CDN for fast file delivery
- **Streaming**: Direct streaming capabilities for video content
- **Lifecycle Management**: Automated cleanup of old files

### 4. Authentication Services

- **OAuth Providers**: GitHub and Google OAuth integration
- **Session Management**: Secure session handling with Better-Auth
- **Security**: HTTPS, secure cookies, CSRF protection

## Deployment Environments

### Development Environment

```yaml
# Development Configuration
environment: development
database:
  host: localhost
  port: 5432
  database: nuclom_dev
  ssl: false
auth:
  secret: dev-secret-key
  requireEmailVerification: false
storage:
  provider: local
  path: ./uploads
```

### Staging Environment

```yaml
# Staging Configuration
environment: staging
database:
  host: staging-db.example.com
  port: 5432
  database: nuclom_staging
  ssl: true
  connectionLimit: 10
auth:
  secret: staging-secret-key
  requireEmailVerification: true
storage:
  provider: cloudflare-r2
  bucket: nuclom-staging
  region: auto
```

### Production Environment

```yaml
# Production Configuration
environment: production
database:
  host: prod-db.example.com
  port: 5432
  database: nuclom_production
  ssl: true
  connectionLimit: 50
  readReplicas:
    - prod-db-read-1.example.com
    - prod-db-read-2.example.com
auth:
  secret: production-secret-key
  requireEmailVerification: true
storage:
  provider: cloudflare-r2
  bucket: nuclom-production
  region: auto
  cdn: true
```

## Deployment Process

### 1. Automated Deployment Pipeline

```mermaid
graph LR
    A[Code Commit] --> B[GitHub Actions]
    B --> C[Run Tests]
    C --> D[Build Application]
    D --> E[Deploy to Vercel]
    E --> F[Run Migrations]
    F --> G[Health Check]
    G --> H[Route Traffic]

    C --> I[Test Failure]
    I --> J[Notify Team]

    G --> K[Deploy Failure]
    K --> L[Rollback]
    L --> J
```

### 2. GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Vercel

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install

      - name: Run linter
        run: pnpm lint

      - name: Run type check
        run: pnpm build

      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: ${{ secrets.TEST_DATABASE_URL }}

  deploy:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'

    steps:
      - uses: actions/checkout@v3

      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-args: "--prod"
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

### 3. Database Migrations

```typescript
// scripts/migrate.ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "@/lib/db";

async function runMigrations() {
  console.log("Running database migrations...");

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("Migrations completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

runMigrations();
```

### 4. Health Checks

```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Check database connectivity
    await db.select().from(users).limit(1);

    // Check external service connectivity
    const checks = await Promise.all([
      checkDatabaseHealth(),
      checkStorageHealth(),
      checkAuthHealth(),
    ]);

    const allHealthy = checks.every((check) => check.healthy);

    return NextResponse.json(
      {
        status: allHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        checks: checks.reduce((acc, check) => {
          acc[check.service] = check.healthy;
          return acc;
        }, {} as Record<string, boolean>),
      },
      { status: allHealthy ? 200 : 503 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}

async function checkDatabaseHealth() {
  try {
    await db.select().from(users).limit(1);
    return { service: "database", healthy: true };
  } catch (error) {
    return { service: "database", healthy: false };
  }
}

async function checkStorageHealth() {
  // Check Cloudflare R2 connectivity
  try {
    // Implement R2 health check
    return { service: "storage", healthy: true };
  } catch (error) {
    return { service: "storage", healthy: false };
  }
}

async function checkAuthHealth() {
  try {
    // Check Better-Auth health
    return { service: "auth", healthy: true };
  } catch (error) {
    return { service: "auth", healthy: false };
  }
}
```

## Environment Configuration

### Environment Variables

```bash
# .env.production
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://nuclom.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/nuclom_production
DATABASE_MAX_CONNECTIONS=50

# Authentication
BETTER_AUTH_SECRET=your-production-secret
BETTER_AUTH_URL=https://nuclom.com

# OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Storage
CLOUDFLARE_R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
CLOUDFLARE_R2_ACCESS_KEY=your-access-key
CLOUDFLARE_R2_SECRET_KEY=your-secret-key
CLOUDFLARE_R2_BUCKET=nuclom-production

# AI Integration
OPENAI_API_KEY=your-openai-api-key

# Monitoring
SENTRY_DSN=your-sentry-dsn
ANALYTICS_ID=your-analytics-id
```

### Vercel Configuration

```json
// vercel.json
{
  "version": 2,
  "builds": [
    {
      "src": "next.config.js",
      "use": "@vercel/next"
    }
  ],
  "routes": [
    {
      "src": "/api/health",
      "dest": "/api/health"
    },
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  },
  "functions": {
    "src/app/api/ai/analyze/route.ts": {
      "maxDuration": 30
    },
    "src/app/api/videos/route.ts": {
      "maxDuration": 10
    }
  }
}
```

## Database Deployment

### Migration Strategy

```typescript
// drizzle/migrate.ts
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL!;

async function main() {
  const client = postgres(connectionString, { max: 1 });
  const db = drizzle(client);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete");

  await client.end();
}

main().catch(console.error);
```

### Backup Strategy

```bash
#!/bin/bash
# scripts/backup-db.sh

# Create backup
pg_dump $DATABASE_URL | gzip > "backup-$(date +%Y%m%d-%H%M%S).sql.gz"

# Upload to cloud storage
aws s3 cp "backup-$(date +%Y%m%d-%H%M%S).sql.gz" s3://nuclom-backups/

# Cleanup old backups (keep last 30 days)
find . -name "backup-*.sql.gz" -mtime +30 -delete
```

### Connection Pooling

```typescript
// src/lib/db/pool.ts
import postgres from "postgres";

const sql = postgres(process.env.DATABASE_URL!, {
  max: 50, // Maximum connections
  idle_timeout: 20, // Close idle connections after 20 seconds
  max_lifetime: 60 * 30, // Close connections after 30 minutes
  prepare: false, // Disable prepared statements for serverless
});

export { sql };
```

## Storage Deployment

### Cloudflare R2 Configuration

```typescript
// src/lib/storage/r2.ts
import { S3Client } from "@aws-sdk/client-s3";

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.CLOUDFLARE_R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_KEY!,
  },
});

export const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET!;
export const R2_PUBLIC_URL = process.env.CLOUDFLARE_R2_PUBLIC_URL!;
```

### File Upload Pipeline

```typescript
// src/lib/storage/upload.ts
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET } from "./r2";

export async function uploadVideoFile(
  file: File,
  organizationId: string,
  videoId: string
): Promise<string> {
  const key = `videos/${organizationId}/${videoId}/${file.name}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type,
      Metadata: {
        organizationId,
        videoId,
        uploadedAt: new Date().toISOString(),
      },
    })
  );

  return `https://${R2_BUCKET}.r2.cloudflarestorage.com/${key}`;
}
```

## Monitoring and Observability

### Application Monitoring

```typescript
// src/lib/monitoring/sentry.ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.Prisma({ client: db }),
  ],
});

export { Sentry };
```

### Performance Monitoring

```typescript
// src/lib/monitoring/metrics.ts
export const metrics = {
  trackPageLoad: (page: string, duration: number) => {
    // Track page load times
    console.log(`Page ${page} loaded in ${duration}ms`);
  },

  trackApiCall: (
    endpoint: string,
    method: string,
    duration: number,
    status: number
  ) => {
    // Track API performance
    console.log(`API ${method} ${endpoint} - ${status} in ${duration}ms`);
  },

  trackDatabaseQuery: (query: string, duration: number) => {
    // Track database performance
    console.log(`Database query completed in ${duration}ms`);
  },
};
```

### Health Monitoring

```typescript
// src/lib/monitoring/health.ts
export class HealthChecker {
  private checks: Map<string, () => Promise<boolean>> = new Map();

  addCheck(name: string, check: () => Promise<boolean>) {
    this.checks.set(name, check);
  }

  async runChecks(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, check] of this.checks) {
      try {
        results[name] = await check();
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }
}

export const healthChecker = new HealthChecker();

// Add health checks
healthChecker.addCheck("database", async () => {
  await db.select().from(users).limit(1);
  return true;
});

healthChecker.addCheck("storage", async () => {
  // Check R2 connectivity
  return true;
});
```

## Security Considerations

### HTTPS Configuration

```typescript
// next.config.ts
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};
```

### Environment Security

```bash
# Secure environment variable handling
# Use Vercel's environment variable encryption
# Rotate secrets regularly
# Use IAM roles for cloud services
# Enable audit logging
```

## Scaling Considerations

### Database Scaling

```typescript
// src/lib/db/scaling.ts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

// Read/write splitting
const writeDb = drizzle(postgres(process.env.DATABASE_WRITE_URL!));
const readDb = drizzle(postgres(process.env.DATABASE_READ_URL!));

export function getDb(operation: "read" | "write" = "read") {
  return operation === "write" ? writeDb : readDb;
}
```

### Caching Strategy

```typescript
// src/lib/cache/redis.ts
import { createClient } from "redis";

const redis = createClient({
  url: process.env.REDIS_URL,
});

export const cache = {
  async get(key: string) {
    return await redis.get(key);
  },

  async set(key: string, value: string, ttl: number = 3600) {
    return await redis.setEx(key, ttl, value);
  },

  async del(key: string) {
    return await redis.del(key);
  },
};
```

### CDN Configuration

```typescript
// src/lib/cdn/config.ts
export const CDN_CONFIG = {
  cloudflare: {
    zoneId: process.env.CLOUDFLARE_ZONE_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN,
  },

  cacheTtl: {
    static: 31536000, // 1 year
    api: 300, // 5 minutes
    dynamic: 60, // 1 minute
  },

  purgeOnDeploy: true,
};
```

## Disaster Recovery

### Backup Strategy

```typescript
// scripts/backup.ts
import { execSync } from "child_process";

async function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupFile = `backup-${timestamp}.sql`;

  // Create database backup
  execSync(`pg_dump ${process.env.DATABASE_URL} > ${backupFile}`);

  // Upload to cloud storage
  execSync(`aws s3 cp ${backupFile} s3://nuclom-backups/`);

  // Cleanup local file
  execSync(`rm ${backupFile}`);

  console.log(`Backup created: ${backupFile}`);
}

createBackup().catch(console.error);
```

### Recovery Procedures

```bash
#!/bin/bash
# scripts/restore.sh

# Download backup
aws s3 cp s3://nuclom-backups/backup-latest.sql backup.sql

# Restore database
psql $DATABASE_URL < backup.sql

# Verify restoration
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
```

## Cost Optimization

### Resource Monitoring

```typescript
// src/lib/monitoring/costs.ts
export const costMonitoring = {
  trackDatabaseUsage: () => {
    // Monitor database connection usage
    // Alert on high connection counts
  },

  trackStorageUsage: () => {
    // Monitor R2 storage usage
    // Alert on unusual upload patterns
  },

  trackComputeUsage: () => {
    // Monitor Vercel function execution
    // Alert on high usage
  },
};
```

### Optimization Strategies

- **Database**: Use connection pooling, optimize queries
- **Storage**: Implement lifecycle policies, compress files
- **Compute**: Optimize function execution time, use edge functions
- **CDN**: Maximize cache hit rates, optimize cache policies

## Future Enhancements

### Infrastructure Improvements

- **Multi-region deployment**: Global availability
- **Edge computing**: Reduce latency with edge functions
- **Microservices**: Break down monolithic API
- **Event-driven architecture**: Async processing with queues

### Automation Enhancements

- **Blue-green deployments**: Zero-downtime deployments
- **Automated rollbacks**: Intelligent failure detection
- **Canary releases**: Gradual feature rollouts
- **Infrastructure as Code**: Terraform/Pulumi for infrastructure

### Monitoring Improvements

- **Real-time alerts**: Proactive issue detection
- **Performance analytics**: Detailed performance insights
- **User analytics**: Usage patterns and optimization
- **Business metrics**: Revenue and growth tracking
