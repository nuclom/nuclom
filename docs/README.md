# Documentation Structure

Nuclom documentation is organized in two locations:

## Primary Documentation (`content/docs/`)

The main documentation is served via [Mintlify](https://mintlify.com) and contains:

- **Architecture** (`content/docs/internal/architecture/`)
  - `database.mdx` - PostgreSQL schema with Drizzle ORM
  - `effect-best-practices.mdx` - Effect-TS patterns and guidelines
  - `effect-ts.mdx` - Effect-TS service architecture
  - `authentication.mdx` - better-auth configuration
  - `deployment.mdx` - Vercel deployment guide
  - `security.mdx` - Security best practices
  - And more...

- **User Guides** (`content/docs/guides/`)
  - Getting started
  - Collaboration workflows
  - Team and organization management
  - Troubleshooting

- **Development Reference** (`content/docs/internal/reference/`)
  - Development setup
  - Testing guidelines
  - Database migrations
  - Environment configuration

- **AI/LLM Instructions** (`content/docs/AGENTS.md`)

## Feature Documentation (`docs/`)

This folder contains feature-specific internal documentation for recently implemented features:

- `internal/architecture/content-source-abstraction.md` - Content source adapter pattern
- `internal/architecture/credential-encryption.md` - OAuth credential encryption

## When to Use Each Location

| Documentation Type | Location |
|-------------------|----------|
| Architecture docs | `content/docs/internal/architecture/` |
| User guides | `content/docs/guides/` |
| API reference | Auto-generated from OpenAPI spec |
| Development setup | `content/docs/internal/reference/` |
| New feature specs | `docs/internal/architecture/` |

## Updating Documentation

1. For existing topics, update the corresponding file in `content/docs/`
2. For new feature documentation, add to `docs/internal/architecture/`
3. Always update `CLAUDE.md` if adding new common patterns
