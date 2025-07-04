# Nuclom Developer Reference

Welcome to the Nuclom developer reference documentation. This guide provides comprehensive information for developers working on the Nuclom video collaboration platform.

## Quick Start

1. **[Development Setup](./development-setup.md)** - Get your development environment up and running
2. **[Environment Configuration](./environment-config.md)** - Configure environment variables and secrets
3. **[Database Setup](./database-setup.md)** - Set up PostgreSQL and run migrations

## Core Development

- **[Component Library](./components.md)** - UI components and design system
- **[Hooks & Utilities](./hooks.md)** - Custom hooks and utility functions
- **[Styling & Theming](./styling.md)** - Tailwind CSS and theme configuration

## Quality & Contribution

- **[Testing Guide](./testing.md)** - Testing strategies and best practices
- **[Contributing Guidelines](./contributing.md)** - Code standards and contribution workflow

## Tech Stack Overview

### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI Library**: Radix UI + shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: React hooks + custom API hooks

### Backend
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: better-auth
- **API**: Next.js API routes
- **File Storage**: Cloudflare R2 (configured)

### Development Tools
- **Code Quality**: Biome (linting & formatting)
- **Package Manager**: pnpm
- **Database Tools**: Drizzle Kit
- **Deployment**: Vercel

## Architecture

Nuclom follows a workspace-based architecture where:
- Users belong to multiple workspaces
- Each workspace contains videos, channels, and series
- Videos can be organized into channels and series
- Users can comment on videos and track viewing progress

## Common Commands

```bash
# Development
pnpm dev                 # Start development server
pnpm build              # Build for production
pnpm start              # Start production server

# Code Quality
pnpm lint               # Run linter
pnpm format             # Format code

# Database
pnpm db:generate        # Generate database schema
pnpm db:migrate         # Run migrations
pnpm db:push            # Push schema to database
pnpm db:studio          # Open database studio
```

## Project Structure

```
nuclom/
├── src/
│   ├── app/                # Next.js app router pages
│   │   ├── (main)/        # Main application routes
│   │   │   └── [workspace]/  # Workspace-scoped routes
│   │   ├── api/           # API routes
│   │   └── globals.css    # Global styles
│   ├── components/        # React components
│   │   ├── ui/           # shadcn/ui components
│   │   └── *.tsx         # Custom components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and configurations
│   │   ├── db/           # Database schema and connection
│   │   └── *.ts          # Utility functions
│   └── types/            # TypeScript type definitions
├── docs/                 # Documentation
├── drizzle/             # Database migrations
└── public/              # Static assets
```

## Getting Help

- Check the [troubleshooting section](./development-setup.md#troubleshooting) for common issues
- Review the [API documentation](../api/) for backend endpoints
- Consult the [architecture guide](../architecture/) for system design details

## Contributing

Please read our [Contributing Guidelines](./contributing.md) before submitting pull requests. We welcome contributions from the community!
