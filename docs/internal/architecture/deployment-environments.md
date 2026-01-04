# Deployment Environments: PROD and Staging

This document outlines the deployment strategy and setup process for Nuclom's two main environments: **Production (PROD)** and **Staging**.

## Environment Overview

| Aspect | Staging | Production |
|--------|---------|------------|
| **Purpose** | Pre-release testing, QA, demos | Live user traffic |
| **URL** | `staging.nuclom.com` | `nuclom.com` |
| **Branch** | `main` (preview deployments) | `main` (production deployment) |
| **Database** | Isolated staging database | Production database with replicas |
| **Data** | Synthetic/sanitized test data | Real user data |
| **Monitoring** | Basic monitoring | Full observability stack |
| **Access** | Internal team only | Public |

## Architecture Diagram

```mermaid
graph TB
    subgraph "Git Repository"
        A[Feature Branch] --> B[Pull Request]
        B --> C[main branch]
    end

    subgraph "Vercel Platform"
        C --> D[Preview Deployment<br/>staging.nuclom.com]
        C --> E[Production Deployment<br/>nuclom.com]
    end

    subgraph "Staging Infrastructure"
        D --> F[Staging Database]
        D --> G[Staging R2 Bucket]
        D --> H[Staging OAuth Apps]
    end

    subgraph "Production Infrastructure"
        E --> I[Production Database<br/>+ Read Replicas]
        E --> J[Production R2 Bucket]
        E --> K[Production OAuth Apps]
    end

    F -.->|"Data sync<br/>(sanitized)"| I
```

## Staging Environment

### Purpose

The staging environment serves as:
- **Pre-production validation**: Test changes before they reach users
- **QA testing**: Manual and automated testing by the team
- **Demo environment**: Showcase features to stakeholders
- **Integration testing**: Verify third-party integrations work correctly

### Setup Process

#### 1. Vercel Project Configuration

Create a separate Vercel project or configure environment-specific settings:

```bash
# Install Vercel CLI
pnpm install -g vercel

# Link to your Vercel project
vercel link

# Set up staging environment
vercel env add STAGING_DATABASE_URL staging
```

In Vercel Dashboard:
1. Go to **Project Settings** > **Domains**
2. Add `staging.nuclom.com` as a custom domain
3. Configure it to deploy from preview branches or `main` branch previews

#### 2. Database Setup

Create a dedicated staging database:

```bash
# Using a cloud provider (e.g., Neon, Supabase, Railway)
# Create a new database instance named "nuclom_staging"

# Set the connection string
DATABASE_URL="postgresql://user:password@staging-host:5432/nuclom_staging?sslmode=require"
```

Database configuration for staging:

```yaml
# Staging database settings
database:
  host: staging-db.provider.com
  port: 5432
  name: nuclom_staging
  ssl: true
  max_connections: 20
  connection_timeout: 10000
```

**Important**: Never use production data directly. Always use sanitized data or synthetic test data.

#### 3. Environment Variables

Set these variables in Vercel for the **Preview** environment:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://staging.nuclom.com

# Database
DATABASE_URL=postgresql://user:password@staging-host:5432/nuclom_staging?sslmode=require

# Authentication
BETTER_AUTH_SECRET=staging-secret-key-rotate-regularly
BETTER_AUTH_URL=https://staging.nuclom.com

# OAuth (use separate staging OAuth apps)
GITHUB_CLIENT_ID=staging-github-client-id
GITHUB_CLIENT_SECRET=staging-github-client-secret
GOOGLE_CLIENT_ID=staging-google-client-id
GOOGLE_CLIENT_SECRET=staging-google-client-secret

# Storage (separate staging bucket)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=staging-access-key
R2_SECRET_ACCESS_KEY=staging-secret-key
R2_BUCKET_NAME=nuclom-staging
R2_PUBLIC_URL=https://staging-assets.nuclom.com

# AI (can share with production, use lower rate limits)
OPENAI_API_KEY=sk-your-openai-api-key
XAI_API_KEY=xai-your-api-key

# Video Processing
REPLICATE_API_TOKEN=r8_your-replicate-token

# Monitoring (separate staging project)
SENTRY_DSN=https://staging-key@sentry.io/staging-project
```

#### 4. OAuth App Configuration

Create separate OAuth applications for staging:

**GitHub OAuth (Staging)**:
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Create new OAuth App named "Nuclom Staging"
3. Set Homepage URL: `https://staging.nuclom.com`
4. Set Authorization callback URL: `https://staging.nuclom.com/api/auth/callback/github`

**Google OAuth (Staging)**:
1. Go to Google Cloud Console
2. Create OAuth 2.0 Client ID for staging
3. Add authorized redirect URI: `https://staging.nuclom.com/api/auth/callback/google`

#### 5. Cloudflare R2 Staging Bucket

```bash
# Using Wrangler CLI
wrangler r2 bucket create nuclom-staging

# Configure CORS for staging domain
wrangler r2 bucket cors put nuclom-staging --config staging-cors.json
```

`staging-cors.json`:
```json
{
  "cors": [
    {
      "allowedOrigins": ["https://staging.nuclom.com"],
      "allowedMethods": ["GET", "PUT", "POST", "DELETE"],
      "allowedHeaders": ["*"],
      "maxAgeSeconds": 3600
    }
  ]
}
```

#### 6. Database Migrations

Run migrations against the staging database:

```bash
# Set staging database URL
export DATABASE_URL="postgresql://user:password@staging-host:5432/nuclom_staging"

# Run migrations
pnpm db:migrate

# Optionally seed with test data
pnpm db:seed --environment=staging
```

### Staging Deployment Workflow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant CI as GitHub Actions
    participant V as Vercel
    participant S as Staging

    Dev->>GH: Push to feature branch
    GH->>CI: Trigger CI workflow
    CI->>CI: Run lint & type check
    GH->>V: Trigger preview deployment
    V->>S: Deploy to staging URL
    V->>GH: Report deployment URL
    CI->>S: Run E2E tests against staging
    CI->>GH: Report test results
```

---

## Production Environment

### Purpose

The production environment serves:
- **Live user traffic**: Real users interacting with the platform
- **Business operations**: Revenue-generating activities
- **Data integrity**: Critical user data storage
- **High availability**: 99.9% uptime target

### Setup Process

#### 1. Vercel Project Configuration

In Vercel Dashboard:
1. Go to **Project Settings** > **Domains**
2. Add `nuclom.com` as the primary custom domain
3. Add `www.nuclom.com` and redirect to apex domain
4. Enable **Production Branch Protection**

```bash
# Configure production deployment settings
vercel env add DATABASE_URL production
vercel env add BETTER_AUTH_SECRET production
```

#### 2. Database Setup

Production database with high availability:

```yaml
# Production database configuration
database:
  primary:
    host: prod-db.provider.com
    port: 5432
    name: nuclom_production
    ssl: true
    max_connections: 100
    connection_timeout: 5000
  replicas:
    - host: prod-db-read-1.provider.com
      port: 5432
    - host: prod-db-read-2.provider.com
      port: 5432
  backup:
    enabled: true
    frequency: daily
    retention: 30 days
    point_in_time_recovery: true
```

**Database Provider Recommendations**:
- **Neon**: Serverless PostgreSQL with autoscaling
- **Supabase**: Managed PostgreSQL with built-in auth
- **Railway**: Simple deployment with automatic backups
- **AWS RDS**: Enterprise-grade with Multi-AZ deployment

#### 3. Environment Variables

Set these variables in Vercel for the **Production** environment:

```bash
# Application
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://nuclom.com

# Database (production with connection pooling)
DATABASE_URL=postgresql://user:password@prod-host:5432/nuclom_production?sslmode=require&connection_limit=100

# Authentication (use strong, unique secrets)
BETTER_AUTH_SECRET=production-256-bit-secret-rotate-quarterly
BETTER_AUTH_URL=https://nuclom.com

# OAuth (production OAuth apps)
GITHUB_CLIENT_ID=prod-github-client-id
GITHUB_CLIENT_SECRET=prod-github-client-secret
GOOGLE_CLIENT_ID=prod-google-client-id
GOOGLE_CLIENT_SECRET=prod-google-client-secret

# Storage (production bucket with CDN)
R2_ACCOUNT_ID=your-account-id
R2_ACCESS_KEY_ID=prod-access-key
R2_SECRET_ACCESS_KEY=prod-secret-key
R2_BUCKET_NAME=nuclom-production
R2_PUBLIC_URL=https://assets.nuclom.com

# AI
OPENAI_API_KEY=sk-your-production-openai-api-key
XAI_API_KEY=xai-your-production-api-key

# Video Processing
REPLICATE_API_TOKEN=r8_your-production-replicate-token

# Monitoring (production monitoring)
SENTRY_DSN=https://prod-key@sentry.io/prod-project
ANALYTICS_ID=your-analytics-id
```

#### 4. OAuth App Configuration

Create production OAuth applications:

**GitHub OAuth (Production)**:
1. Create OAuth App named "Nuclom"
2. Set Homepage URL: `https://nuclom.com`
3. Set Authorization callback URL: `https://nuclom.com/api/auth/callback/github`

**Google OAuth (Production)**:
1. Create OAuth 2.0 Client ID for production
2. Add authorized redirect URI: `https://nuclom.com/api/auth/callback/google`
3. Submit for verification if requesting sensitive scopes

#### 5. Cloudflare R2 Production Bucket

```bash
# Create production bucket
wrangler r2 bucket create nuclom-production

# Configure CORS
wrangler r2 bucket cors put nuclom-production --config production-cors.json

# Set up custom domain for CDN
# In Cloudflare Dashboard: R2 > nuclom-production > Settings > Public Access
# Connect custom domain: assets.nuclom.com
```

#### 6. CDN and Caching Configuration

Configure Cloudflare for production:

```javascript
// Cloudflare Page Rules (or Transform Rules)
{
  "rules": [
    {
      "expression": "(http.request.uri.path contains \"/api/\")",
      "action": "bypass_cache"
    },
    {
      "expression": "(http.request.uri.path contains \"/_next/static/\")",
      "action": {
        "cache_level": "cache_everything",
        "edge_cache_ttl": 31536000
      }
    },
    {
      "expression": "(http.request.uri.path contains \"/videos/\")",
      "action": {
        "cache_level": "cache_everything",
        "edge_cache_ttl": 86400
      }
    }
  ]
}
```

### Production Deployment Workflow

```mermaid
sequenceDiagram
    participant Dev as Developer
    participant GH as GitHub
    participant CI as GitHub Actions
    participant V as Vercel
    participant S as Staging
    participant P as Production

    Dev->>GH: Merge PR to main
    GH->>CI: Trigger CI workflow
    CI->>CI: Run lint & type check
    GH->>V: Trigger deployments
    V->>S: Deploy preview (staging)
    V->>P: Deploy production
    CI->>S: Run E2E tests against staging
    CI->>GH: Report test results
    Note over P: Production receives traffic<br/>after successful checks
```

---

## Environment Comparison

### Infrastructure Resources

| Resource | Staging | Production |
|----------|---------|------------|
| **Compute** | Vercel Hobby/Pro | Vercel Pro/Enterprise |
| **Database** | Single instance, 20 connections | Primary + 2 replicas, 100 connections |
| **Storage** | 10GB R2 bucket | 1TB+ R2 bucket with CDN |
| **Bandwidth** | Limited | Unlimited |
| **Functions** | 10s timeout | 30s timeout |

### Security Differences

| Security Aspect | Staging | Production |
|-----------------|---------|------------|
| **Access** | Team-only, may use basic auth | Public |
| **Secrets rotation** | Monthly | Weekly |
| **Audit logging** | Optional | Required |
| **DDoS protection** | Basic | Enterprise |
| **SSL certificates** | Auto-provisioned | Auto-provisioned |

---

## CI/CD Pipeline Configuration

### GitHub Actions Workflows

The CI/CD pipeline consists of two main workflows:

#### 1. CI Workflow (`.github/workflows/ci.yml`)

Runs on every push and PR to validate code quality:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - name: Lint
        run: pnpm lint
      - name: Type Check
        run: pnpm tsc --noEmit
```

#### 2. E2E Tests Workflow (`.github/workflows/e2e.yml`)

Runs Playwright tests against Vercel deployments:

```yaml
name: E2E Tests

on:
  deployment_status:
  workflow_dispatch:
    inputs:
      deployment_url:
        description: "Deployment URL to test against"
        required: true

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    if: |
      github.event_name == 'workflow_dispatch' ||
      (github.event.deployment_status.state == 'success')
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install chromium --with-deps
      - name: Run E2E tests
        run: pnpm test:e2e
        env:
          PLAYWRIGHT_BASE_URL: ${{ github.event.deployment_status.target_url || github.event.inputs.deployment_url }}
```

### Vercel Configuration

Configure Vercel to handle both environments:

**Project Settings**:
1. **Git**: Connect to GitHub repository
2. **Build & Development Settings**:
   - Framework Preset: Next.js
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`
3. **Environment Variables**: Set per environment (Production, Preview, Development)

**Deployment Protection** (recommended for production):
- Enable "Deployment Protection" in Project Settings
- Require team membership to access preview deployments

---

## Database Migration Strategy

### Migration Process

```mermaid
graph LR
    A[Generate Migration] --> B[Test Locally]
    B --> C[Deploy to Staging]
    C --> D[Verify on Staging]
    D --> E[Deploy to Production]
    E --> F[Verify on Production]
```

### Running Migrations

```bash
# 1. Generate migration from schema changes
pnpm db:generate

# 2. Test migration locally
DATABASE_URL="postgresql://localhost:5432/nuclom_dev" pnpm db:migrate

# 3. Apply to staging
DATABASE_URL="$STAGING_DATABASE_URL" pnpm db:migrate

# 4. Apply to production (during maintenance window if needed)
DATABASE_URL="$PRODUCTION_DATABASE_URL" pnpm db:migrate
```

### Zero-Downtime Migrations

For production, follow these principles:
1. **Add columns as nullable** first, then backfill and add constraints
2. **Never drop columns** in the same release that removes code usage
3. **Use feature flags** for schema-dependent features
4. **Test rollback procedures** on staging

---

## Promotion Workflow: Staging to Production

### Pre-Deployment Checklist

```markdown
## Pre-Deployment Checklist

### Code Quality
- [ ] All CI checks pass (lint, type check)
- [ ] E2E tests pass on staging deployment
- [ ] Manual QA completed on staging
- [ ] No critical bugs in staging

### Database
- [ ] Migrations tested on staging
- [ ] Rollback migration prepared
- [ ] Backup verified

### Configuration
- [ ] Environment variables updated in production
- [ ] Feature flags configured
- [ ] Third-party service limits checked

### Communication
- [ ] Team notified of deployment
- [ ] Status page updated (if applicable)
- [ ] Support team briefed on changes
```

### Deployment Steps

1. **Merge to main**: PR merge triggers automatic deployment
2. **Monitor staging**: Verify staging deployment succeeds
3. **Production deployment**: Automatic after staging verification
4. **Health check**: Verify `/api/health` returns healthy status
5. **Smoke test**: Run critical path tests
6. **Monitor**: Watch error rates and performance metrics

---

## Rollback Procedures

### Vercel Instant Rollback

```bash
# List recent deployments
vercel ls

# Rollback to previous deployment
vercel rollback [deployment-url]

# Or use Vercel Dashboard:
# Project > Deployments > Select previous deployment > Promote to Production
```

### Database Rollback

```bash
# If migration needs to be reverted
# Note: Drizzle doesn't auto-generate down migrations

# Option 1: Restore from backup
pg_restore -d $DATABASE_URL backup.sql

# Option 2: Manual rollback (prepare in advance)
psql $DATABASE_URL -f migrations/rollback/001_rollback.sql
```

### Emergency Procedures

1. **Immediate rollback**: Use Vercel instant rollback (< 1 minute)
2. **Feature flag disable**: Turn off problematic features
3. **Database restore**: Point-in-time recovery if data corruption
4. **Communication**: Update status page and notify users

---

## Monitoring and Alerting

### Health Endpoints

Implement health checks for both environments:

```typescript
// src/app/api/health/route.ts
import { NextResponse } from "next/server";
import { connection } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  await connection();

  const checks = {
    database: false,
    storage: false,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  };

  try {
    // Database check
    await db.execute(sql`SELECT 1`);
    checks.database = true;

    // Storage check (optional)
    checks.storage = true;

    return NextResponse.json({
      status: "healthy",
      ...checks,
    });
  } catch (error) {
    return NextResponse.json({
      status: "unhealthy",
      ...checks,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 503 });
  }
}
```

### Monitoring Setup

| Tool | Staging | Production |
|------|---------|------------|
| **Error Tracking** | Sentry (staging project) | Sentry (production project) |
| **Performance** | Vercel Analytics | Vercel Analytics + custom metrics |
| **Uptime** | Optional | Required (e.g., Better Uptime) |
| **Logs** | Vercel Logs | Vercel Logs + log aggregation |

### Alerting Rules

Configure alerts for production:

```yaml
# Example alerting configuration
alerts:
  - name: High Error Rate
    condition: error_rate > 1%
    duration: 5 minutes
    severity: critical
    notify: [slack, pagerduty]

  - name: Slow Response Time
    condition: p95_latency > 2000ms
    duration: 10 minutes
    severity: warning
    notify: [slack]

  - name: Database Connection Issues
    condition: db_connection_errors > 0
    duration: 1 minute
    severity: critical
    notify: [slack, pagerduty]
```

---

## Environment Setup Checklist

### Staging Environment Setup

```markdown
## Staging Setup Checklist

### Infrastructure
- [ ] Vercel project configured
- [ ] staging.nuclom.com domain added
- [ ] SSL certificate provisioned

### Database
- [ ] Staging database created
- [ ] Connection string configured
- [ ] Migrations applied
- [ ] Test data seeded

### Storage
- [ ] R2 staging bucket created
- [ ] CORS configured
- [ ] Access keys generated

### Authentication
- [ ] Staging OAuth apps created (GitHub)
- [ ] Staging OAuth apps created (Google)
- [ ] BETTER_AUTH_SECRET configured

### Environment Variables
- [ ] All required variables set in Vercel Preview environment
- [ ] Variables validated

### Testing
- [ ] E2E tests pass against staging
- [ ] Manual smoke test completed
```

### Production Environment Setup

```markdown
## Production Setup Checklist

### Infrastructure
- [ ] Vercel project configured for production
- [ ] nuclom.com domain added
- [ ] www redirect configured
- [ ] SSL certificate provisioned

### Database
- [ ] Production database created
- [ ] Read replicas configured (if needed)
- [ ] Connection pooling enabled
- [ ] Automated backups configured
- [ ] Point-in-time recovery enabled

### Storage
- [ ] R2 production bucket created
- [ ] CDN custom domain configured
- [ ] CORS configured
- [ ] Lifecycle policies set

### Authentication
- [ ] Production OAuth apps created (GitHub)
- [ ] Production OAuth apps created (Google)
- [ ] OAuth apps verified (Google)
- [ ] Strong BETTER_AUTH_SECRET generated

### Environment Variables
- [ ] All required variables set in Vercel Production environment
- [ ] Secrets rotated from initial setup
- [ ] Variables validated

### Security
- [ ] Security headers verified
- [ ] CSP policy tested
- [ ] Rate limiting configured
- [ ] DDoS protection enabled

### Monitoring
- [ ] Sentry production project created
- [ ] Uptime monitoring configured
- [ ] Alert rules configured
- [ ] On-call rotation set

### Testing
- [ ] E2E tests pass
- [ ] Load testing completed
- [ ] Security scan completed
```

---

## Related Documentation

- [Deployment Architecture](./deployment.md) - Overall deployment infrastructure
- [Environment Configuration](../reference/environment-config.md) - Environment variables reference
- [Database Setup](../reference/database-setup.md) - Database configuration guide
- [Security](./security.md) - Security considerations and best practices
