# Nuclom Documentation

Documentation for Nuclom, a video collaboration platform built with Next.js 16, React 19, and modern web technologies.

## Documentation Structure

### [Public Documentation](public/)

User-facing documentation and API reference:

- **[User Guides](public/guides/)** - Complete user documentation for end users
- **[API Documentation](public/api/)** - Developer API reference for integrations
- **[Getting Started](public/guides/getting-started.md)** - New user onboarding

### [Internal Documentation](internal/)

Developer and contributor documentation:

- **[Developer Reference](internal/reference/)** - Development setup, components, and code patterns
- **[System Architecture](internal/architecture/)** - System design and architectural decisions
- **[Contributing Guidelines](internal/reference/contributing.md)** - Development workflow and standards

## Quick Start

| Audience | Start Here |
|----------|------------|
| **Users** | [Getting Started Guide](public/guides/getting-started.md) |
| **Developers** | [Development Setup](internal/reference/development-setup.md) |
| **API Integrators** | [API Documentation](public/api/README.md) |

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Effect-TS, PostgreSQL, Drizzle ORM
- **Authentication**: better-auth with OAuth (GitHub, Google)
- **Storage**: Cloudflare R2
- **AI**: OpenAI / Vercel AI SDK
- **Testing**: Vitest, Playwright
- **Deployment**: Vercel with CI/CD

## Documentation Updates

This documentation is maintained alongside the codebase. When making code changes, please update relevant documentation in the same PR.

See [AGENTS.md](AGENTS.md) for AI/LLM instructions when working with documentation.
