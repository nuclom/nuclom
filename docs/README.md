# Nuclom Documentation

> **Video collaboration for modern teams** — Upload, organize, and collaborate on video content with AI-powered insights.

---

## Quick Navigation

| I want to...                          | Go to                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| **Get started as a user**             | [Getting Started Guide](public/guides/getting-started.md)    |
| **Set up my development environment** | [Development Setup](internal/reference/development-setup.md) |
| **Integrate with the API**            | [API Documentation](public/api/README.md)                    |
| **Understand the architecture**       | [Architecture Overview](internal/architecture/README.md)     |
| **Contribute to the project**         | [Contributing Guidelines](internal/reference/contributing.md)|

---

## Documentation Overview

### For Users

Everything you need to use Nuclom effectively.

- **[User Guides](public/guides/)** — Step-by-step guides for all features
- **[Getting Started](public/guides/getting-started.md)** — Create your account and upload your first video
- **[Troubleshooting](public/guides/troubleshooting.md)** — Solutions to common issues

### For Developers

Build integrations and extend Nuclom.

- **[API Reference](public/api/README.md)** — RESTful API documentation with examples
- **[Authentication](public/api/authentication.md)** — OAuth and session-based auth
- **[AI Features](public/api/ai.md)** — Video analysis, summaries, and insights

### For Contributors

Set up your environment and understand the codebase.

- **[Development Setup](internal/reference/development-setup.md)** — Get running locally in 5 minutes
- **[Architecture](internal/architecture/README.md)** — System design and decisions
- **[Code Patterns](internal/reference/)** — Components, hooks, and styling

---

## Tech Stack at a Glance

| Layer          | Technologies                                      |
| -------------- | ------------------------------------------------- |
| **Frontend**   | Next.js 16, React 19, TypeScript, Tailwind CSS    |
| **UI**         | shadcn/ui, Radix UI, Lucide Icons                 |
| **Backend**    | Next.js API Routes, Effect-TS                     |
| **Database**   | PostgreSQL, Drizzle ORM                           |
| **Auth**       | Better-Auth (GitHub, Google OAuth)                |
| **Storage**    | Cloudflare R2                                     |
| **AI**         | OpenAI, Vercel AI SDK                             |
| **Deployment** | Vercel with CI/CD                                 |

---

## Key Features

- **Multi-organization support** — Separate workspaces for different teams
- **AI-powered insights** — Automatic summaries and action item extraction
- **Time-stamped comments** — Leave feedback at specific video moments
- **Smart organization** — Channels, series, and tags for structure
- **Role-based access** — Owner, Admin, and Member permissions

---

## Keeping Docs Updated

> **Important:** When making code changes, update the relevant documentation in the same PR.

- Architecture changes → Update `docs/internal/architecture/`
- API changes → Update `docs/public/api/`
- New features → Update `docs/public/guides/`

See [AGENTS.md](AGENTS.md) for AI/LLM coding instructions.

---

**Need help?** Start with the [Getting Started Guide](public/guides/getting-started.md) or check [Troubleshooting](public/guides/troubleshooting.md).
