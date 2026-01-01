/**
 * Client-side error logging utility
 *
 * Provides a centralized way to log errors to monitoring services.
 * Currently logs to console, but can be extended to send to external services
 * like Sentry, LogRocket, or a custom endpoint.
 */

// Detect environment without using process global (works in both server and client)
const IS_DEV = typeof window !== "undefined" ? window.location.hostname === "localhost" : true;
const IS_PROD = !IS_DEV;

export interface ClientErrorLog {
  error: Error;
  componentStack?: string;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiErrorLog {
  url: string;
  method: string;
  status: number;
  errorCode?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log a client-side React error (e.g., from Error Boundary)
 */
export function logClientError(log: ClientErrorLog): void {
  const errorData = {
    type: "CLIENT_ERROR",
    timestamp: new Date().toISOString(),
    name: log.error.name,
    message: log.error.message,
    stack: log.error.stack,
    componentStack: log.componentStack,
    context: log.context,
    metadata: log.metadata,
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
  };

  // Log to console in development
  if (IS_DEV) {
    console.group("🔴 Client Error");
    console.error(log.error);
    if (log.componentStack) {
      console.error("Component Stack:", log.componentStack);
    }
    console.groupEnd();
  }

  // In production, send to monitoring service
  if (IS_PROD) {
    sendToMonitoringService(errorData);
  }
}

/**
 * Log an API error (e.g., failed fetch request)
 */
export function logApiError(log: ApiErrorLog): void {
  const errorData = {
    type: "API_ERROR",
    timestamp: new Date().toISOString(),
    ...log,
    currentUrl: typeof window !== "undefined" ? window.location.href : undefined,
  };

  if (IS_DEV) {
    console.group("🔴 API Error");
    console.error(`${log.method} ${log.url} - ${log.status}`);
    console.error("Message:", log.message);
    if (log.errorCode) {
      console.error("Error Code:", log.errorCode);
    }
    console.groupEnd();
  }

  if (IS_PROD) {
    sendToMonitoringService(errorData);
  }
}

/**
 * Log an unhandled promise rejection
 */
export function logUnhandledRejection(event: PromiseRejectionEvent): void {
  const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

  logClientError({
    error,
    context: "UnhandledPromiseRejection",
  });
}

/**
 * Log a global error
 */
export function logGlobalError(event: ErrorEvent): void {
  const error = event.error instanceof Error ? event.error : new Error(event.message);

  logClientError({
    error,
    context: "GlobalError",
    metadata: {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
    },
  });
}

/**
 * Send error data to monitoring service
 * Extend this function to integrate with your preferred service
 */
async function sendToMonitoringService(errorData: Record<string, unknown>): Promise<void> {
  try {
    // Option 1: Send to your own API endpoint
    // await fetch("/api/errors", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify(errorData),
    // });

    // Option 2: Use a service like Sentry
    // Sentry.captureException(errorData.error, {
    //   extra: errorData,
    // });

    // For now, just log to console in a way that can be picked up by server logs
    console.error("[ERROR_LOG]", JSON.stringify(errorData));
  } catch {
    // Silently fail - we don't want error logging to cause more errors
    console.error("Failed to send error to monitoring service");
  }
}

/**
 * Initialize global error handlers
 * Call this once in your app's entry point
 */
export function initializeErrorHandlers(): void {
  if (typeof window === "undefined") return;

  // Handle unhandled promise rejections
  window.addEventListener("unhandledrejection", logUnhandledRejection);

  // Handle global errors
  window.addEventListener("error", logGlobalError);
}

/**
 * Clean up global error handlers
 */
export function cleanupErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.removeEventListener("unhandledrejection", logUnhandledRejection);
  window.removeEventListener("error", logGlobalError);
}
