/**
 * Error Logging Utility
 *
 * Provides centralized error logging for client-side errors
 * with structured JSON format compatible with Vercel's log ingestion.
 */
/** biome-ignore-all lint/suspicious/noConsole: Logger */

import { env } from './env/client';

// =============================================================================
// Types
// =============================================================================

export interface ErrorContext {
  requestId?: string;
  userId?: string;
  organizationId?: string;
  path?: string;
  method?: string;
  digest?: string;
  componentStack?: string;
}

export interface ClientErrorLog {
  error: Error;
  componentStack?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

interface StructuredErrorLog {
  timestamp: string;
  level: 'error';
  service: string;
  environment: string;
  type: 'CLIENT_ERROR';
  error: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    digest?: string;
  };
  context?: ErrorContext;
  metadata?: Record<string, unknown>;
  client?: {
    url?: string;
    userAgent?: string;
    referrer?: string;
  };
}

// =============================================================================
// Configuration
// =============================================================================

const SERVICE_NAME = 'nuclom';
const IS_SERVER = typeof window === 'undefined';
const IS_PROD = IS_SERVER ? env.NODE_ENV === 'production' : !window.location.hostname.includes('localhost');
const ENVIRONMENT = IS_PROD ? 'production' : 'development';

// =============================================================================
// Structured Error Formatting
// =============================================================================

function createStructuredError(
  error: Error & { digest?: string; code?: string },
  options?: {
    context?: ErrorContext;
    metadata?: Record<string, unknown>;
    componentStack?: string;
  },
): StructuredErrorLog {
  const log: StructuredErrorLog = {
    timestamp: new Date().toISOString(),
    level: 'error',
    service: SERVICE_NAME,
    environment: ENVIRONMENT,
    type: 'CLIENT_ERROR',
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error.code,
      digest: error.digest,
    },
  };

  if (options?.context) {
    log.context = options.context;
    if (options.componentStack) {
      log.context.componentStack = options.componentStack;
    }
  }

  if (options?.metadata) {
    log.metadata = options.metadata;
  }

  if (!IS_SERVER && typeof window !== 'undefined') {
    log.client = {
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer || undefined,
    };
  }

  return log;
}

function outputError(log: StructuredErrorLog): void {
  if (IS_PROD) {
    console.error(JSON.stringify(log));
  } else {
    console.group(`[CLIENT_ERROR] ${log.error.name}: ${log.error.message}`);
    console.error('Error:', log.error);
    if (log.context) console.error('Context:', log.context);
    if (log.metadata) console.error('Metadata:', log.metadata);
    if (log.client) console.error('Client:', log.client);
    console.groupEnd();
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Log a client-side React error (e.g., from Error Boundary)
 */
export function logClientError(log: ClientErrorLog): void {
  const structuredLog = createStructuredError(log.error, {
    context: {
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    },
    metadata: {
      ...log.metadata,
      errorContext: log.context,
    },
    componentStack: log.componentStack,
  });

  outputError(structuredLog);
}

/**
 * Log error from React Error Boundary (Vercel-compatible)
 */
export function logErrorBoundary(
  error: Error & { digest?: string },
  options?: {
    digest?: string;
    componentStack?: string;
    userId?: string;
    organizationId?: string;
  },
): void {
  const structuredLog = createStructuredError(error, {
    context: {
      digest: options?.digest || error.digest,
      userId: options?.userId,
      organizationId: options?.organizationId,
      path: typeof window !== 'undefined' ? window.location.pathname : undefined,
    },
    componentStack: options?.componentStack,
  });

  outputError(structuredLog);
}
