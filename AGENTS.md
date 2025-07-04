# Nuclom - Video Collaboration Platform

## Commands

- `pnpm dev` - Start development server
- `pnpm build` - Build for production
- `pnpm start` - Start production server
- `pnpm lint` - Run biome checker
- `pnpm format` - Run biome formatter
- No tests configured

## Architecture

- Next.js 15 app router with TypeScript, using src/ directory structure
- Tailwind CSS + shadcn/ui components
- React Server Components enabled
- Dark theme by default with next-themes
- Workspace-based routing: `/[workspace]/{page}`
- Main pages: videos, channels, series, search, shared, settings
- Files organized under src/: app/, components/, lib/, hooks/

## Tech Stack

- PostgreSQL
- BetterAuth
- Cloudflare R2

## Code Style

- Use `@/` imports for internal modules (resolves to src/)
- Import `type` for TypeScript types: `import type { Metadata } from "next"`
- Use `cn()` utility from `@/lib/utils` for className merging
- Strict TypeScript with ESLint (next/core-web-vitals, next/typescript)
- Readonly props for React components
- Use shadcn/ui components for consistency
- Follow Next.js 15 app router patterns
