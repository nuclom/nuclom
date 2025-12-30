"use client";

import { useEffect } from "react";
import { logClientError } from "@/lib/error-logging";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Global error handler for root layout errors
 * This is a minimal fallback that doesn't rely on any components
 * since the root layout itself may have failed
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    logClientError({
      error,
      context: "GlobalError",
      metadata: {
        digest: error.digest,
      },
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#09090b",
            color: "#fafafa",
            fontFamily: "system-ui, -apple-system, sans-serif",
            padding: "1rem",
          }}
        >
          <div
            style={{
              maxWidth: "28rem",
              width: "100%",
              textAlign: "center",
              padding: "2rem",
              borderRadius: "0.5rem",
              border: "1px solid #27272a",
              backgroundColor: "#18181b",
            }}
          >
            <div
              style={{
                width: "4rem",
                height: "4rem",
                margin: "0 auto 1.5rem",
                borderRadius: "50%",
                backgroundColor: "rgba(239, 68, 68, 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#ef4444"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                <path d="M12 9v4" />
                <path d="M12 17h.01" />
              </svg>
            </div>

            <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1rem" }}>Something went wrong</h1>

            <p style={{ color: "#a1a1aa", marginBottom: "1.5rem", lineHeight: 1.5 }}>
              A critical error occurred. Please try again or contact support if the problem persists.
            </p>

            {error.digest && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "#71717a",
                  marginBottom: "1.5rem",
                }}
              >
                Error ID:{" "}
                <code
                  style={{
                    backgroundColor: "#27272a",
                    padding: "0.125rem 0.375rem",
                    borderRadius: "0.25rem",
                  }}
                >
                  {error.digest}
                </code>
              </p>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <button
                onClick={reset}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.375rem",
                  border: "none",
                  backgroundColor: "#fafafa",
                  color: "#09090b",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              <button
                onClick={() => (window.location.href = "/")}
                style={{
                  width: "100%",
                  padding: "0.75rem 1rem",
                  borderRadius: "0.375rem",
                  border: "1px solid #27272a",
                  backgroundColor: "transparent",
                  color: "#fafafa",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Go to home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
