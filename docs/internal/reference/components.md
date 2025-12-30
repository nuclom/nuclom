# Component Library

Nuclom uses a comprehensive component library built on top of Radix UI and styled with Tailwind CSS. This guide covers the component architecture, available components, and best practices.

## Architecture

### Component Structure

```
src/components/
├── ui/                     # shadcn/ui components
│   ├── button.tsx         # Base button component
│   ├── card.tsx           # Card components
│   ├── dialog.tsx         # Modal dialogs
│   └── ...                # Other UI primitives
├── video-card.tsx         # Custom video card
├── organization-switcher.tsx # Organization selector
├── top-nav.tsx           # Top navigation
├── settings-sidebar.tsx   # Settings sidebar
├── command-bar.tsx       # Command palette
├── theme-provider.tsx    # Theme context
└── theme-toggle.tsx      # Theme switcher
```

### Design System

- **Base**: Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables
- **Theme**: Light/Dark mode support
- **Icons**: Lucide React icons
- **Animations**: Tailwind CSS animations

## UI Components (shadcn/ui)

### Button

```typescript
import { Button } from "@/components/ui/button";

// Variants
<Button variant="default">Default</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="link">Link</Button>

// Sizes
<Button size="default">Default</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon">
  <IconName className="h-4 w-4" />
</Button>

// States
<Button disabled>Disabled</Button>
<Button loading>Loading</Button>
```

### Card

```typescript
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>;
```

### Dialog

```typescript
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>Dialog description</DialogDescription>
    </DialogHeader>
    <div>Dialog content</div>
  </DialogContent>
</Dialog>;
```

### Form Components

```typescript
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Form with validation
<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
    <FormField
      control={form.control}
      name="title"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Title</FormLabel>
          <FormControl>
            <Input placeholder="Enter title" {...field} />
          </FormControl>
          <FormDescription>
            This will be the display name for your video.
          </FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
    <Button type="submit">Submit</Button>
  </form>
</Form>;
```

### Navigation

```typescript
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Getting started</NavigationMenuTrigger>
      <NavigationMenuContent>
        <NavigationMenuLink href="/docs">Documentation</NavigationMenuLink>
      </NavigationMenuContent>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>;
```

### Data Display

```typescript
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Table
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Created</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>Video Title</TableCell>
      <TableCell>
        <Badge variant="success">Published</Badge>
      </TableCell>
      <TableCell>2 hours ago</TableCell>
    </TableRow>
  </TableBody>
</Table>

// Avatar
<Avatar>
  <AvatarImage src="/user-avatar.jpg" alt="User" />
  <AvatarFallback>UN</AvatarFallback>
</Avatar>
```

## Custom Components

### VideoCard

```typescript
import { VideoCard } from "@/components/video-card";

<VideoCard
  video={{
    id: "1",
    title: "Introduction to React",
    description: "Learn the basics of React",
    duration: "10:30",
    thumbnailUrl: "/thumbnail.jpg",
    author: { name: "John Doe", avatarUrl: "/avatar.jpg" },
    createdAt: new Date(),
  }}
  onClick={() => console.log("Video clicked")}
/>;
```

### OrganizationSwitcher

```typescript
import { OrganizationSwitcher } from "@/components/organization-switcher";

<OrganizationSwitcher
  currentOrganization={currentOrganization}
  organizations={organizations}
  onOrganizationChange={(organization) => {
    // Handle organization change
  }}
/>;
```

### TopNav

```typescript
import { TopNav } from "@/components/top-nav";

<TopNav
  user={user}
  currentOrganization={currentOrganization}
  onSearch={(query) => {
    // Handle search
  }}
/>;
```

### CommandBar

```typescript
import { CommandBar } from "@/components/command-bar";

<CommandBar
  open={commandBarOpen}
  onOpenChange={setCommandBarOpen}
  commands={[
    {
      id: "create-video",
      label: "Create Video",
      icon: VideoIcon,
      action: () => {
        // Create video action
      },
    },
  ]}
/>;
```

### VideoPlayer

A full-featured video player component with professional controls, keyboard shortcuts, chapter navigation, and progress tracking.

```typescript
import { VideoPlayer, VideoPlayerWithProgress, type VideoChapter } from "@/components/video";

// Define chapters (optional)
const chapters: VideoChapter[] = [
  { id: "1", title: "Introduction", startTime: 0 },
  { id: "2", title: "Main Content", startTime: 120 },
  { id: "3", title: "Conclusion", startTime: 540 },
];

// Basic video player
<VideoPlayer
  url="https://example.com/video.mp4"
  title="My Video"
  thumbnailUrl="/thumbnail.jpg"
  initialProgress={0.5} // Start at 50%
  chapters={chapters} // Optional chapter markers
  onProgress={(progress) => {
    console.log("Current time:", progress.currentTime);
    console.log("Duration:", progress.duration);
    console.log("Progress fraction:", progress.played);
    console.log("Completed:", progress.completed);
  }}
  onTimeUpdate={(time) => console.log("Time:", time)} // For syncing with transcript
  onEnded={() => console.log("Video ended")}
  onError={(error) => console.error("Playback error:", error)}
/>;

// Video player with automatic progress persistence
<VideoPlayerWithProgress
  videoId="video-123"
  url="https://example.com/video.mp4"
  title="My Video"
  thumbnailUrl="/thumbnail.jpg"
  duration="10:30"
  chapters={chapters}
  onTimeUpdate={(time) => console.log("Time:", time)}
  onEnded={() => console.log("Video ended")}
/>;
```

**Features:**
- Standard controls (play/pause, seek, volume, fullscreen)
- Picture-in-Picture (PiP) mode for multitasking
- Loop mode toggle for repeat playback
- Chapter markers on the progress bar with click-to-seek
- Hover time preview on progress bar
- Buffered progress visualization
- Double-click to toggle fullscreen
- Playback speed control (0.5x to 2x)
- Progress tracking and persistence
- Resume from last position
- Loading states and error handling
- Responsive design for mobile and desktop
- Current chapter display overlay

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| Space / K | Play / Pause |
| J / ← | Skip back 10 seconds |
| L / → | Skip forward 10 seconds |
| ↑ / ↓ | Volume up / down |
| M | Mute / Unmute |
| F | Toggle fullscreen |
| P | Toggle Picture-in-Picture |
| C | Toggle loop mode |
| 0-9 | Jump to 0-90% of video |
| Home / End | Jump to start / end |
| ? | Show keyboard shortcuts help |

## Component Patterns

### Compound Components

```typescript
// Card with multiple parts
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content
  </CardContent>
</Card>

// Dialog with trigger
<Dialog>
  <DialogTrigger asChild>
    <Button>Open</Button>
  </DialogTrigger>
  <DialogContent>
    Content
  </DialogContent>
</Dialog>
```

### Polymorphic Components

```typescript
// Button as different elements
<Button asChild>
  <Link href="/videos">View Videos</Link>
</Button>

<Button asChild>
  <a href="https://example.com">External Link</a>
</Button>
```

### Render Props

```typescript
// Custom hook with render prop
function useVideoPlayer(videoId: string) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  return {
    isPlaying,
    currentTime,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
  };
}

// Usage
function VideoPlayer({
  videoId,
  children,
}: {
  videoId: string;
  children: (props: ReturnType<typeof useVideoPlayer>) => React.ReactNode;
}) {
  const playerProps = useVideoPlayer(videoId);
  return <div>{children(playerProps)}</div>;
}
```

## Styling Guidelines

### CSS Variables

```css
/* src/app/globals.css */
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
  /* ... */
}
```

### Utility Classes

```typescript
import { cn } from "@/lib/utils";

// Conditional classes
<div className={cn(
  "base-classes",
  {
    "conditional-class": condition,
    "another-class": anotherCondition,
  }
)} />

// Variant-based classes
<Button className={cn(
  "base-button-styles",
  variant === "primary" && "primary-styles",
  variant === "secondary" && "secondary-styles"
)} />
```

### Responsive Design

```typescript
// Responsive classes
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Responsive grid */}
</div>

// Responsive text
<h1 className="text-2xl md:text-3xl lg:text-4xl font-bold">
  Responsive Heading
</h1>
```

## Component Development

### Creating New Components

1. **Create component file**:

```typescript
// src/components/my-component.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MyComponentProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly variant?: "default" | "primary" | "secondary";
  readonly size?: "sm" | "md" | "lg";
}

export function MyComponent({
  children,
  className,
  variant = "default",
  size = "md",
}: MyComponentProps) {
  return (
    <div
      className={cn(
        // Base styles
        "rounded-lg border p-4",
        // Variant styles
        {
          "bg-background text-foreground": variant === "default",
          "bg-primary text-primary-foreground": variant === "primary",
          "bg-secondary text-secondary-foreground": variant === "secondary",
        },
        // Size styles
        {
          "text-sm p-2": size === "sm",
          "text-base p-4": size === "md",
          "text-lg p-6": size === "lg",
        },
        className
      )}
    >
      {children}
    </div>
  );
}
```

2. **Add to index file** (optional):

```typescript
// src/components/index.ts
export { MyComponent } from "./my-component";
```

3. **Create stories** (if using Storybook):

```typescript
// src/components/my-component.stories.tsx
import type { Meta, StoryObj } from "@storybook/react";
import { MyComponent } from "./my-component";

const meta: Meta<typeof MyComponent> = {
  title: "Components/MyComponent",
  component: MyComponent,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Default component",
  },
};

export const Primary: Story = {
  args: {
    children: "Primary component",
    variant: "primary",
  },
};
```

### Component Testing

```typescript
// src/components/__tests__/my-component.test.tsx
import { render, screen } from "@testing-library/react";
import { MyComponent } from "../my-component";

describe("MyComponent", () => {
  it("renders children", () => {
    render(<MyComponent>Test content</MyComponent>);
    expect(screen.getByText("Test content")).toBeInTheDocument();
  });

  it("applies variant classes", () => {
    render(<MyComponent variant="primary">Test</MyComponent>);
    const element = screen.getByText("Test");
    expect(element).toHaveClass("bg-primary");
  });

  it("merges custom className", () => {
    render(<MyComponent className="custom-class">Test</MyComponent>);
    const element = screen.getByText("Test");
    expect(element).toHaveClass("custom-class");
  });
});
```

## Accessibility

### ARIA Attributes

```typescript
// Proper ARIA attributes
<button
  aria-label="Close dialog"
  aria-expanded={isOpen}
  aria-controls="dialog-content"
  onClick={onClose}
>
  <X className="h-4 w-4" />
</button>

// Form labels
<label htmlFor="email" className="sr-only">
  Email address
</label>
<input
  id="email"
  type="email"
  placeholder="Enter your email"
  aria-describedby="email-description"
/>
<p id="email-description" className="text-sm text-muted-foreground">
  We'll never share your email.
</p>
```

### Keyboard Navigation

```typescript
// Keyboard event handling
function handleKeyDown(event: React.KeyboardEvent) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    onClick();
  }
}

<div
  role="button"
  tabIndex={0}
  onKeyDown={handleKeyDown}
  onClick={onClick}
  className="cursor-pointer"
>
  Clickable content
</div>;
```

### Focus Management

```typescript
// Focus management with refs
const buttonRef = useRef<HTMLButtonElement>(null);

useEffect(() => {
  if (isOpen) {
    buttonRef.current?.focus();
  }
}, [isOpen]);

<button
  ref={buttonRef}
  className="focus:outline-none focus:ring-2 focus:ring-primary"
>
  Focusable button
</button>;
```

## Performance Optimization

### Code Splitting

```typescript
// Dynamic imports for large components
const HeavyComponent = dynamic(() => import("./heavy-component"), {
  loading: () => <div>Loading...</div>,
  ssr: false,
});
```

### Memoization

```typescript
import { memo, useMemo } from "react";

// Memoized component
const ExpensiveComponent = memo(function ExpensiveComponent({ data, filter }) {
  const filteredData = useMemo(() => {
    return data.filter((item) => item.category === filter);
  }, [data, filter]);

  return (
    <div>
      {filteredData.map((item) => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
});
```

### Virtual Scrolling

```typescript
// For large lists
import { FixedSizeList as List } from "react-window";

function VirtualList({ items }: { items: any[] }) {
  const Row = ({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  );

  return (
    <List height={600} itemCount={items.length} itemSize={50} width="100%">
      {Row}
    </List>
  );
}
```

## Best Practices

### Component Design

1. **Keep components small and focused**
2. **Use composition over inheritance**
3. **Make components reusable**
4. **Provide good TypeScript types**
5. **Handle edge cases gracefully**

### Props Design

```typescript
// Good: Specific and typed props
interface VideoCardProps {
  readonly video: {
    id: string;
    title: string;
    duration: string;
    thumbnailUrl?: string;
  };
  readonly onClick?: () => void;
  readonly className?: string;
}

// Avoid: Generic or unclear props
interface BadProps {
  readonly data: any;
  readonly config?: Record<string, unknown>;
}
```

### Error Boundaries

```typescript
// Error boundary for component isolation
class ComponentErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div>Something went wrong.</div>;
    }

    return this.props.children;
  }
}
```

## Next Steps

- [Learn about hooks and utilities](./hooks.md)
- [Understand styling and theming](./styling.md)
- [Set up testing for components](./testing.md)
- [Explore the API integration](../api/)
