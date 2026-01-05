import process from "node:process";
import { ReadableStream, TransformStream, WritableStream } from "node:stream/web";
import "@testing-library/jest-dom";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll, vi } from "vitest";

// Polyfill Web Streams API for Node.js environment
if (typeof globalThis.TransformStream === "undefined") {
  // @ts-expect-error - Polyfill for Node.js
  globalThis.TransformStream = TransformStream;
  // @ts-expect-error - Polyfill for Node.js
  globalThis.ReadableStream = ReadableStream;
  globalThis.WritableStream = WritableStream;
}

const setEnvDefault = (key: string, value: string) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
};

setEnvDefault("BETTER_AUTH_SECRET", "test-better-auth-secret-32-characters");
setEnvDefault("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/nuclom_test");
setEnvDefault("RESEND_API_KEY", "re_test");
setEnvDefault("GITHUB_CLIENT_ID", "github_test");
setEnvDefault("GITHUB_CLIENT_SECRET", "github_test_secret");
setEnvDefault("GOOGLE_CLIENT_ID", "google_test");
setEnvDefault("GOOGLE_CLIENT_SECRET", "google_test_secret");
setEnvDefault("R2_ACCOUNT_ID", "r2_test_account");
setEnvDefault("R2_ACCESS_KEY_ID", "r2_test_access_key");
setEnvDefault("R2_SECRET_ACCESS_KEY", "r2_test_secret_key");
setEnvDefault("R2_BUCKET_NAME", "r2_test_bucket");
setEnvDefault("STRIPE_SECRET_KEY", "sk_test_123");
setEnvDefault("STRIPE_WEBHOOK_SECRET", "whsec_test_123");

// Mock Next.js router
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: ({ src, alt, ...props }: { src: string; alt: string; [key: string]: unknown }) => {
    // biome-ignore lint/performance/noImgElement: Mock component for testing
    return <img src={src} alt={alt} {...props} />;
  },
}));

// Mock Next.js Link component
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  },
}));

// Mock window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Suppress console errors in tests unless needed
const originalError = console.error;
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    // Filter out known React warnings in tests
    const message = args[0];
    if (
      typeof message === "string" &&
      (message.includes("Warning: ReactDOM.render") || message.includes("Warning: An update to"))
    ) {
      return;
    }
    originalError.apply(console, args);
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

afterAll(() => {
  console.error = originalError;
});
