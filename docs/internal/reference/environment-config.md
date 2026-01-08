# Environment Configuration

This guide covers how to configure environment variables and secrets for Nuclom development and production.

## Environment Files

### Development

Create `.env.local` for local development:

```bash
cp .env.example .env.local
```

### Production

Set environment variables in your deployment platform (Vercel, Railway, etc.).

## Required Environment Variables

### Database

```env
# PostgreSQL connection string
DATABASE_URL="postgresql://username:password@localhost:5432/nuclom"

# Example formats:
# Local: postgresql://postgres:password@localhost:5432/nuclom
# Railway: postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway
# Supabase: postgresql://postgres:password@db.project.supabase.co:5432/postgres
# PlanetScale: mysql://username:password@aws.connect.psdb.cloud/database?sslaccept=strict
```

### Authentication

```env
# Better Auth configuration
BETTER_AUTH_SECRET="your-random-secret-key-here"

# GitHub OAuth (optional)
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"

# Google OAuth (optional)
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Disable new user signups (for staging environments)
DISABLE_SIGNUPS="true"  # Set to "true" or "1" to disable signups
```

### AI Integration

```env
# AI Gateway for text generation (uses XAI Grok-3 via Vercel AI SDK)
# No API key needed - uses @ai-sdk/gateway
```

### Video Processing

```env
# Replicate API key for video transcription (Whisper model)
REPLICATE_API_TOKEN="r8_your-replicate-token"
```

### File Storage

```env
# Cloudflare R2 configuration
R2_ACCOUNT_ID="your-r2-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="nuclom-videos"
```

## Environment Setup by Service

### Database Providers

#### Local PostgreSQL

```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt install postgresql  # Ubuntu

# Start PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Ubuntu

# Create database
createdb nuclom

# Environment variable
DATABASE_URL="postgresql://postgres:password@localhost:5432/nuclom"
```

#### Railway

1. Create a new PostgreSQL database in Railway
2. Copy the connection string from the database settings
3. Set the `DATABASE_URL` environment variable

```env
DATABASE_URL="postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway"
```

#### Supabase

1. Create a new project in Supabase
2. Go to Settings → Database
3. Copy the connection string
4. Set the `DATABASE_URL` environment variable

```env
DATABASE_URL="postgresql://postgres:password@db.project.supabase.co:5432/postgres"
```

#### PlanetScale

1. Create a new database in PlanetScale
2. Create a connection string
3. Set the `DATABASE_URL` environment variable

```env
DATABASE_URL="mysql://username:password@aws.connect.psdb.cloud/database?sslaccept=strict"
```

### Authentication Setup

#### Better Auth Secret

Generate a secure secret:

```bash
# Generate a random secret
openssl rand -base64 32

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### GitHub OAuth

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Create a new OAuth App
3. Set Authorization callback URL to `http://localhost:5001/api/auth/callback/github`
4. Copy Client ID and Client Secret

```env
GITHUB_CLIENT_ID="your-github-client-id"
GITHUB_CLIENT_SECRET="your-github-client-secret"
```

#### Google OAuth

1. Go to Google Cloud Console
2. Create a new project or select existing
3. Enable Google+ API
4. Go to Credentials → Create Credentials → OAuth client ID
5. Set authorized redirect URIs to `http://localhost:5001/api/auth/callback/google`
6. Copy Client ID and Client Secret

```env
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### AI Integration Setup

#### AI Services

The application uses:
- **XAI Grok-3** via `@ai-sdk/gateway` for text generation (summaries, tags, action items)
- **Replicate Whisper** for video transcription

No additional API keys are needed for text generation as it uses the Vercel AI SDK gateway.

### File Storage Setup

#### Cloudflare R2

1. Go to Cloudflare Dashboard → R2
2. Create a new bucket
3. Go to Manage R2 API tokens
4. Create a new token with R2 permissions
5. Set the environment variables

```env
R2_ACCOUNT_ID="your-r2-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key"
R2_SECRET_ACCESS_KEY="your-r2-secret-key"
R2_BUCKET_NAME="nuclom-videos"
```

## Environment Validation

### Runtime Validation

The application validates environment variables at runtime:

```typescript
// src/lib/env.ts
import { z } from "zod/v4";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  REPLICATE_API_TOKEN: z.string().min(1).optional(),
  // ... other variables
});

export const env = envSchema.parse(process.env);
```

### Validation Script

Create a validation script:

```bash
#!/bin/bash
# scripts/validate-env.sh

required_vars=(
  "DATABASE_URL"
  "BETTER_AUTH_SECRET"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "Error: $var is not set"
    exit 1
  fi
done

echo "All required environment variables are set"
```

## Security Best Practices

### Secret Management

1. **Never commit secrets to version control**
2. **Use different secrets for different environments**
3. **Rotate secrets regularly**
4. **Use environment-specific configurations**

### Database Security

1. **Use connection pooling**
2. **Enable SSL connections**
3. **Use read-only connections where possible**
4. **Implement proper access controls**

### API Keys

1. **Use least privilege principle**
2. **Set usage limits**
3. **Monitor API usage**
4. **Implement rate limiting**

## Production Configuration

### Vercel

Set environment variables in Vercel dashboard:

1. Go to Project Settings → Environment Variables
2. Add production environment variables
3. Set appropriate environments (Production, Preview, Development)

### Railway

Set environment variables in Railway:

1. Go to your project
2. Click on Variables tab
3. Add environment variables

### Docker

Use environment files with Docker:

```dockerfile
# Use environment file
docker run --env-file .env.production nuclom:latest

# Or set individual variables
docker run -e DATABASE_URL="..." nuclom:latest
```

## Environment Testing

### Test Database Connection

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# Test with Node.js
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error(err);
  else console.log('Database connected:', res.rows[0]);
  pool.end();
});
"
```

### Test API Keys

```bash
# Test authentication endpoints
curl http://localhost:5001/api/auth/session
```

## Troubleshooting

### Common Issues

#### Database Connection Failures

```bash
# Check if database is reachable
nc -zv hostname port

# Check connection string format
echo $DATABASE_URL

# Test with psql
psql $DATABASE_URL
```

#### Authentication Issues

```bash
# Check if secret is set
echo $BETTER_AUTH_SECRET

# Verify OAuth redirect URLs
curl -I http://localhost:5001/api/auth/callback/github
```

#### Missing Environment Variables

```bash
# Check if all required variables are set
env | grep -E "(DATABASE_URL|BETTER_AUTH_SECRET|REPLICATE_API_TOKEN)"

# Validate environment
pnpm build  # This will fail if required variables are missing
```

### Debug Environment

```bash
# Print all environment variables (be careful not to expose secrets)
printenv | grep -v SECRET | grep -v PASSWORD

# Check specific variables
echo "Database URL: ${DATABASE_URL%%:*}://***"
echo "Auth configured: ${BETTER_AUTH_SECRET:+Yes}"
```

## Next Steps

- [Set up the database](./database-setup.md)
- [Configure development tools](./development-setup.md)
- [Deploy to production](../guides/deployment.md)
