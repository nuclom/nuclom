# Nuclom Internal Documentation

Internal documentation for developers, contributors, and maintainers of the Nuclom video collaboration platform.

## 🔧 Developer Resources

### Development Setup

- **[Development Setup](reference/development-setup.md)** - Complete environment setup
- **[Environment Configuration](reference/environment-config.md)** - Environment variables and config
- **[Database Setup](reference/database-setup.md)** - Database configuration and migrations

### Technical Reference

- **[Component Library](reference/components.md)** - UI components and patterns
- **[Hooks & Utilities](reference/hooks.md)** - Custom hooks and helper functions
- **[Styling Guide](reference/styling.md)** - CSS, theming, and design system

### Quality & Testing

- **[Testing Guide](reference/testing.md)** - Testing strategy and implementation
- **[Contributing Guidelines](reference/contributing.md)** - Code standards and workflow

## 🏗️ System Architecture

### Architecture Overview

- **[System Design](architecture/README.md)** - High-level architecture overview
- **[Database Schema](architecture/database.md)** - Complete database design
- **[Frontend Architecture](architecture/frontend.md)** - Next.js and React patterns
- **[Authentication System](architecture/authentication.md)** - better-auth implementation
- **[Deployment Strategy](architecture/deployment.md)** - Infrastructure and CI/CD

### Technical Deep Dives

- **[System Summary](architecture/summary.md)** - Quick technical reference
- **[Security Considerations](architecture/authentication.md#security)** - Security best practices
- **[Performance Optimization](architecture/frontend.md#performance)** - Performance strategies

## 🛠️ Tech Stack

### Core Technologies

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, PostgreSQL, Drizzle ORM
- **Authentication**: better-auth with OAuth (GitHub, Google)
- **Storage**: Cloudflare R2 (configured)
- **AI**: OpenAI GPT integration
- **Deployment**: Vercel with automated CI/CD

### Development Tools

- **Build**: pnpm, TypeScript, Biome (linting/formatting)
- **Database**: Drizzle ORM, PostgreSQL, Drizzle Kit migrations
- **UI**: shadcn/ui components, Tailwind CSS, Radix UI
- **State**: React hooks, Context API
- **Testing**: Jest, React Testing Library, Playwright (planned)

## 📋 Development Workflow

### Getting Started

1. **[Environment Setup](reference/development-setup.md)** - Install dependencies and configure
2. **[Database Setup](reference/database-setup.md)** - Set up PostgreSQL and run migrations
3. **[Contributing](reference/contributing.md)** - Understand the development process

### Common Commands

```bash
# Development
pnpm dev                 # Start development server
pnpm build              # Build for production
pnpm start              # Start production server

# Code Quality
pnpm lint               # Run biome checker
pnpm format             # Run biome formatter

# Database
pnpm db:generate        # Generate migrations
pnpm db:migrate         # Run migrations
pnpm db:push            # Push schema changes
pnpm db:studio          # Open database GUI
```

### Development Guidelines

- Follow TypeScript strict mode
- Use shadcn/ui components for consistency
- Implement proper error handling and loading states
- Write tests for critical functionality
- Follow the established code style and patterns

## 🔍 Architecture Patterns

### Frontend Patterns

- **App Router**: Next.js 15 with organization-based routing
- **Server Components**: React Server Components for performance
- **Client Components**: Interactive components with hooks
- **Type Safety**: Full TypeScript integration

### Backend Patterns

- **API Routes**: RESTful endpoints with proper error handling
- **Database**: Drizzle ORM with PostgreSQL
- **Authentication**: Session-based auth with better-auth
- **Validation**: Zod schemas for request validation

### Security Patterns

- **CSRF Protection**: Built-in CSRF handling
- **Role-Based Access**: Organization permissions (Owner, Admin, Member)
- **Input Validation**: Server-side validation for all inputs
- **Secure Sessions**: HTTP-only cookies with proper expiration

## 📊 Project Structure

```
src/
├── app/                 # Next.js app router
│   ├── (main)/         # Organization-based routes
│   ├── api/            # API endpoints
│   └── globals.css     # Global styles
├── components/         # React components
│   ├── ui/            # shadcn/ui components
│   └── *.tsx          # Custom components
├── lib/               # Utilities and configuration
│   ├── db/            # Database schema and connection
│   ├── auth.ts        # Authentication config
│   └── utils.ts       # Utility functions
└── hooks/             # Custom React hooks
```

## 🚀 Deployment

### Production Environment

- **Platform**: Vercel with automatic deployments
- **Database**: PostgreSQL (Supabase/PlanetScale recommended)
- **Storage**: Cloudflare R2 for video files
- **Monitoring**: Built-in Vercel analytics

### Environment Variables

See **[Environment Configuration](reference/environment-config.md)** for complete setup.

## 🤝 Contributing

### Before Contributing

1. Review **[Contributing Guidelines](reference/contributing.md)**
2. Set up your **[Development Environment](reference/development-setup.md)**
3. Understand the **[System Architecture](architecture/README.md)**

### Development Process

1. Fork the repository
2. Create a feature branch
3. Follow coding standards and patterns
4. Write tests for new functionality
5. Submit a pull request

---

**Need help?** Check the specific documentation sections or reach out to the development team.
