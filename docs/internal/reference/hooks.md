# Hooks and Utilities

This guide covers the custom hooks, utility functions, and helper libraries used in Nuclom.

## Custom Hooks

### API Hooks

#### useVideos

Fetches videos with filtering and pagination support.

```typescript
import { useVideos } from "@/hooks/use-api";

function VideoList() {
  const { data, loading, error } = useVideos({
    organizationId: "organization-123",
    channelId: "channel-456", // optional
    seriesId: "series-789", // optional
    page: 1,
    limit: 20,
  });

  if (loading) return <div>Loading videos...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No videos found</div>;

  return (
    <div>
      {data.data.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
      <Pagination
        currentPage={data.pagination.page}
        totalPages={data.pagination.totalPages}
        onPageChange={(page) => {
          // Handle page change
        }}
      />
    </div>
  );
}
```

#### useVideo

Fetches a single video with full details.

```typescript
import { useVideo } from "@/hooks/use-api";

function VideoDetail({ videoId }: { videoId: string }) {
  const { data: video, loading, error } = useVideo(videoId);

  if (loading) return <VideoSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  if (!video) return <div>Video not found</div>;

  return (
    <div>
      <h1>{video.title}</h1>
      <p>{video.description}</p>
      <VideoPlayer src={video.videoUrl} />
      <CommentSection comments={video.comments} />
    </div>
  );
}
```

#### useOrganizations

Fetches user organizations.

```typescript
import { useOrganizations } from "@/hooks/use-api";

function OrganizationList() {
  const { data: organizations, loading, error } = useOrganizations();

  if (loading) return <div>Loading organizations...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {organizations?.map((organization) => (
        <OrganizationCard key={organization.id} organization={organization} />
      ))}
    </div>
  );
}
```

### UI Hooks

#### useMobile

Detects mobile devices and screen sizes.

```typescript
import { useMobile } from "@/hooks/use-mobile";

function ResponsiveComponent() {
  const isMobile = useMobile();

  return <div>{isMobile ? <MobileNavigation /> : <DesktopNavigation />}</div>;
}
```

#### useToast

Provides toast notifications.

```typescript
import { useToast } from "@/hooks/use-toast";

function VideoUpload() {
  const { toast } = useToast();

  const handleUpload = async (file: File) => {
    try {
      await uploadVideo(file);
      toast({
        title: "Success",
        description: "Video uploaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload video",
        variant: "destructive",
      });
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="video/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
    </div>
  );
}
```

#### useVideoProgress

Manages video playback progress with automatic debounced persistence.

```typescript
import { useVideoProgress, useProgressFraction } from "@/hooks/use-video-progress";

function VideoPlayerContainer({ videoId }: { videoId: string }) {
  const {
    initialProgress,    // Saved position in seconds
    loading,            // Whether progress data is loading
    error,              // Error message if fetch failed
    wasCompleted,       // Whether video was previously completed
    saveProgress,       // Debounced save function
    saveProgressNow,    // Immediate save function
    markCompleted,      // Mark video as completed
  } = useVideoProgress({
    videoId,
    saveInterval: 5000,  // Save every 5 seconds
    enabled: true,       // Enable progress tracking
  });

  // Convert seconds to progress fraction for the player
  const progressFraction = useProgressFraction(initialProgress, videoDuration);

  if (loading) return <div>Loading...</div>;

  return (
    <VideoPlayer
      initialProgress={progressFraction}
      onProgress={(progress) => {
        saveProgress(progress);
      }}
      onEnded={() => markCompleted()}
    />
  );
}
```

**Features:**
- Automatic progress persistence with debouncing
- Resume from last position
- Track completed videos
- Graceful error handling (doesn't interrupt playback)

## Custom Hook Patterns

### Data Fetching Hook

```typescript
// src/hooks/use-data-fetcher.ts
import { useEffect, useState } from "react";

interface UseDataFetcherOptions<T> {
  fetcher: () => Promise<T>;
  dependencies?: React.DependencyList;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

export function useDataFetcher<T>({
  fetcher,
  dependencies = [],
  onSuccess,
  onError,
}: UseDataFetcherOptions<T>) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const result = await fetcher();

        if (isMounted) {
          setData(result);
          onSuccess?.(result);
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage =
            err instanceof Error ? err.message : "Unknown error";
          setError(errorMessage);
          onError?.(err as Error);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, dependencies);

  return { data, loading, error, refetch: () => fetchData() };
}
```

### Local Storage Hook

```typescript
// src/hooks/use-local-storage.ts
import { useEffect, useState } from "react";

export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === "undefined") {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);

      if (typeof window !== "undefined") {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [storedValue, setValue];
}
```

### Debounced Hook

```typescript
// src/hooks/use-debounced.ts
import { useEffect, useState } from "react";

export function useDebounced<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Usage
function SearchComponent() {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 300);

  const { data: results } = useSearch(debouncedQuery);

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search videos..."
      />
      {results && (
        <div>
          {results.map((result) => (
            <div key={result.id}>{result.title}</div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### Async Hook

```typescript
// src/hooks/use-async.ts
import { useCallback, useEffect, useState } from "react";

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  dependencies: React.DependencyList = []
) {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    setState({ data: null, loading: true, error: null });

    try {
      const result = await asyncFunction();
      setState({ data: result, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  return { ...state, execute };
}
```

## Utility Functions

### Class Name Utilities

```typescript
// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Usage
<div
  className={cn(
    "base-class",
    condition && "conditional-class",
    { "variant-class": variant === "primary" },
    className
  )}
/>;
```

### Date Utilities

```typescript
// src/lib/date-utils.ts
import { format, formatDistanceToNow } from "date-fns";

export function formatDate(date: Date | string, formatStr = "PPP"): string {
  return format(new Date(date), formatStr);
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

// Usage
<div>
  <p>Created: {formatDate(video.createdAt)}</p>
  <p>Updated: {formatRelativeTime(video.updatedAt)}</p>
  <p>Duration: {formatDuration(video.duration)}</p>
</div>;
```

### Validation Utilities

```typescript
// src/lib/validation.ts
import { Schema } from "effect";
import { safeParse } from "@/lib/validation";

export const videoSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  duration: Schema.String,
  thumbnailUrl: Schema.optional(Schema.String),
  videoUrl: Schema.optional(Schema.String),
});

export const organizationSchema = Schema.Struct({
  name: Schema.String,
  slug: Schema.String,
  description: Schema.optional(Schema.String),
});

export function validateVideo(data: unknown) {
  return safeParse(videoSchema, data);
}

export function validateOrganization(data: unknown) {
  return safeParse(organizationSchema, data);
}
```

### API Utilities

```typescript
// src/lib/api-utils.ts
export class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchWithRetry<T>(
  url: string,
  options: RequestInit = {},
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        throw new ApiError(response.status, response.statusText);
      }

      return await response.json();
    } catch (error) {
      lastError = error as Error;

      if (i === maxRetries) {
        throw lastError;
      }

      // Exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }

  throw lastError!;
}

export function createQueryString(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  return searchParams.toString();
}
```

### Form Utilities

```typescript
// src/lib/form-utils.ts
import { UseFormReturn } from "react-hook-form";

export function getFormErrors(form: UseFormReturn<any>) {
  return Object.keys(form.formState.errors).reduce((acc, key) => {
    acc[key] = form.formState.errors[key]?.message;
    return acc;
  }, {} as Record<string, string>);
}

export function resetFormWithData<T>(form: UseFormReturn<T>, data: Partial<T>) {
  form.reset(data);
  form.clearErrors();
}

export function handleFormSubmit<T>(
  form: UseFormReturn<T>,
  onSubmit: (data: T) => Promise<void>
) {
  return form.handleSubmit(async (data) => {
    try {
      await onSubmit(data);
    } catch (error) {
      console.error("Form submission error:", error);
      // Handle error (e.g., show toast)
    }
  });
}
```

## Type Utilities

### Common Types

```typescript
// src/lib/types.ts
export type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type Required<T, K extends keyof T> = T & {
  [P in K]-?: T[P];
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type ValueOf<T> = T[keyof T];

export type ArrayElement<T> = T extends readonly (infer U)[] ? U : never;
```

### API Response Types

```typescript
// src/lib/api-types.ts
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  status: number;
  message: string;
  details?: Record<string, unknown>;
}
```

## React Utilities

### HOCs (Higher-Order Components)

```typescript
// src/lib/hocs.ts
import { ComponentType } from "react";

export function withLoading<T extends object>(Component: ComponentType<T>) {
  return function WithLoadingComponent(props: T & { loading?: boolean }) {
    const { loading, ...rest } = props;

    if (loading) {
      return <div>Loading...</div>;
    }

    return <Component {...(rest as T)} />;
  };
}

export function withErrorBoundary<T extends object>(
  Component: ComponentType<T>
) {
  return function WithErrorBoundaryComponent(props: T) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}
```

### Render Props

```typescript
// src/lib/render-props.ts
import { ReactNode } from "react";

interface AsyncRenderProps<T> {
  children: (state: {
    data: T | null;
    loading: boolean;
    error: Error | null;
  }) => ReactNode;
  fetcher: () => Promise<T>;
}

export function AsyncRender<T>({ children, fetcher }: AsyncRenderProps<T>) {
  const { data, loading, error } = useAsync(fetcher);

  return <>{children({ data, loading, error })}</>;
}

// Usage
<AsyncRender fetcher={() => fetchVideo(videoId)}>
  {({ data, loading, error }) => {
    if (loading) return <LoadingSpinner />;
    if (error) return <ErrorMessage error={error} />;
    if (!data) return <NotFound />;
    return <VideoPlayer video={data} />;
  }}
</AsyncRender>;
```

## Testing Utilities

### Test Helpers

```typescript
// src/lib/test-utils.ts
import { render, RenderOptions } from "@testing-library/react";
import { ReactElement } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  const queryClient = createTestQueryClient();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, "wrapper">
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from "@testing-library/react";
export { customRender as render };
```

### Mock Data

```typescript
// src/lib/mock-data.ts
export const mockUser = {
  id: "user-1",
  email: "user@example.com",
  name: "Test User",
  avatarUrl: "https://example.com/avatar.jpg",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
};

export const mockVideo = {
  id: "video-1",
  title: "Test Video",
  description: "Test video description",
  duration: "10:30",
  thumbnailUrl: "https://example.com/thumbnail.jpg",
  videoUrl: "https://example.com/video.mp4",
  authorId: "user-1",
  organizationId: "organization-1",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
};

export const mockOrganization = {
  id: "organization-1",
  name: "Test Organization",
  slug: "test-organization",
  description: "Test organization description",
  createdAt: new Date("2023-01-01"),
  updatedAt: new Date("2023-01-01"),
};
```

## Performance Utilities

### Memoization

```typescript
// src/lib/memo-utils.ts
import { useCallback, useMemo } from "react";

export function useMemoizedCallback<T extends (...args: any[]) => any>(
  callback: T,
  deps: React.DependencyList
): T {
  return useCallback(callback, deps);
}

export function useMemoizedValue<T>(
  factory: () => T,
  deps: React.DependencyList
): T {
  return useMemo(factory, deps);
}

export function createMemoizedSelector<T, R>(selector: (state: T) => R) {
  let lastState: T;
  let lastResult: R;

  return (state: T): R => {
    if (state === lastState) {
      return lastResult;
    }

    lastState = state;
    lastResult = selector(state);
    return lastResult;
  };
}
```

## Best Practices

### Hook Guidelines

1. **Use descriptive names** that start with "use"
2. **Keep hooks focused** on a single responsibility
3. **Handle cleanup** in useEffect return functions
4. **Use TypeScript** for better type safety
5. **Include error handling** in async hooks

### Utility Guidelines

1. **Make functions pure** when possible
2. **Use proper TypeScript types**
3. **Include comprehensive JSDoc comments**
4. **Write unit tests** for utilities
5. **Keep functions small** and focused

### Performance Tips

1. **Memoize expensive computations**
2. **Use useCallback** for event handlers
3. **Implement proper dependency arrays**
4. **Avoid unnecessary re-renders**
5. **Use React.memo** for expensive components

## Next Steps

- [Learn about styling and theming](./styling.md)
- [Set up testing for hooks](./testing.md)
- [Understand the component architecture](./components.md)
- [Explore the API integration](../api/)
