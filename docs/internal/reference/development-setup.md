# Development Setup

This guide will help you set up your local development environment for Nuclom.

## Prerequisites

- **Node.js** 18.x or higher
- **pnpm** 8.x or higher
- **PostgreSQL** 14.x or higher
- **Git**

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/SferaDev/nuclom.git
cd nuclom
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Environment Configuration

Copy the environment template:

```bash
cp .env.example .env.local
```

See [Environment Configuration](./environment-config.md) for detailed setup instructions.

### 4. Database Setup

Set up your PostgreSQL database:

```bash
# Generate database schema
pnpm db:generate

# Run migrations
pnpm db:migrate

# Optional: Open database studio
pnpm db:studio
```

See [Database Setup](./database-setup.md) for detailed instructions.

### 5. Start Development Server

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

## Development Workflow

### Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── (main)/            # Main application routes
│   │   └── [workspace]/   # Workspace-scoped routes
│   │       ├── channels/  # Channel management
│   │       ├── series/    # Series management
│   │       ├── videos/    # Video management
│   │       ├── search/    # Search functionality
│   │       ├── shared/    # Shared content
│   │       └── settings/  # Workspace settings
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   └── *.tsx             # Custom components
├── hooks/                # Custom React hooks
├── lib/                  # Utilities and configurations
│   ├── db/              # Database schema and connection
│   ├── auth.ts          # Authentication configuration
│   ├── api.ts           # API client
│   └── utils.ts         # Utility functions
```

### Code Organization

#### Components
- **UI Components**: Use shadcn/ui components in `src/components/ui/`
- **Custom Components**: Create reusable components in `src/components/`
- **Page Components**: Keep page-specific components close to their routes

#### Hooks
- **API Hooks**: Use custom hooks in `src/hooks/use-api.ts`
- **Utility Hooks**: Create custom hooks for reusable logic

#### Utilities
- **Database**: Schema and types in `src/lib/db/`
- **API Client**: Type-safe API client in `src/lib/api.ts`
- **Utils**: Common utilities in `src/lib/utils.ts`

### Import Conventions

Use the configured path aliases:

```typescript
// Components
import { Button } from "@/components/ui/button";
import { VideoCard } from "@/components/video-card";

// Hooks
import { useVideos } from "@/hooks/use-api";

// Utilities
import { cn } from "@/lib/utils";
import { videoApi } from "@/lib/api";

// Types
import type { VideoWithAuthor } from "@/lib/types";
```

## Common Tasks

### Adding a New Component

1. Create the component file:

```typescript
// src/components/my-component.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MyComponentProps {
  readonly children: ReactNode;
  readonly className?: string;
}

export function MyComponent({ children, className }: MyComponentProps) {
  return (
    <div className={cn("my-component-styles", className)}>
      {children}
    </div>
  );
}
```

2. Export from index if needed:

```typescript
// src/components/index.ts
export { MyComponent } from "./my-component";
```

### Adding a New API Endpoint

1. Define the API route:

```typescript
// src/app/api/my-endpoint/route.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    // Your logic here
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

2. Add to API client:

```typescript
// src/lib/api.ts
export const myApi = {
  async getMyData(): Promise<MyDataType> {
    return fetchApi("/my-endpoint");
  },
};
```

3. Create a custom hook:

```typescript
// src/hooks/use-api.ts
export function useMyData() {
  const [state, setState] = useState<UseApiState<MyDataType>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Fetch logic
  }, []);

  return state;
}
```

### Adding a New Database Model

1. Define the schema:

```typescript
// src/lib/db/schema.ts
export const myTable = pgTable('my_table', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export type MyModel = typeof myTable.$inferSelect;
export type NewMyModel = typeof myTable.$inferInsert;
```

2. Add relations if needed:

```typescript
export const myTableRelations = relations(myTable, ({ one, many }) => ({
  // Define relations
}));
```

3. Generate and run migration:

```bash
pnpm db:generate
pnpm db:migrate
```

## Code Quality

### Linting and Formatting

```bash
# Check code quality
pnpm lint

# Fix issues automatically
pnpm lint:fix

# Format code
pnpm format
```

### TypeScript

- Use strict TypeScript configuration
- Import types with `import type`
- Use readonly props for React components
- Leverage type inference where possible

### React Best Practices

- Use functional components with hooks
- Implement proper error boundaries
- Use React.memo for expensive components
- Handle loading and error states

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
pnpm build
pnpm analyze
```

### Image Optimization

Use Next.js Image component:

```typescript
import Image from "next/image";

<Image
  src="/video-thumbnail.jpg"
  alt="Video thumbnail"
  width={400}
  height={300}
  priority={false}
/>
```

### API Optimization

- Use React Query for caching (if implemented)
- Implement proper pagination
- Use database indexes for queries
- Optimize database queries

## Troubleshooting

### Common Issues

#### Database Connection Issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Verify connection string
psql $DATABASE_URL
```

#### Node.js Version Issues

```bash
# Check Node.js version
node --version

# Use nvm to switch versions
nvm use 18
```

#### Package Installation Issues

```bash
# Clear pnpm cache
pnpm store prune

# Reinstall dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

#### Build Issues

```bash
# Clear Next.js cache
rm -rf .next

# Rebuild
pnpm build
```

### Debug Mode

Enable debug logging:

```bash
# Set debug environment variable
DEBUG=* pnpm dev

# Or specific debug namespaces
DEBUG=nuclom:* pnpm dev
```

### Getting Help

1. Check the [troubleshooting guide](../guides/troubleshooting.md)
2. Review existing [GitHub issues](https://github.com/SferaDev/nuclom/issues)
3. Ask questions in the development channel
4. Consult the [architecture documentation](../architecture/)

## Next Steps

- [Configure your environment](./environment-config.md)
- [Set up the database](./database-setup.md)
- [Learn about the component library](./components.md)
- [Understand the styling system](./styling.md)
