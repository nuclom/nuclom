/**
 * Workflow-Safe Logger
 *
 * A simple console-based logger for use in workflow functions.
 * This logger does NOT use Node.js modules (pino, AsyncLocalStorage, crypto)
 * which are not available in the Workflow DevKit runtime.
 *
 * For full-featured logging in non-workflow code, use @/lib/logger instead.
 */

export type WorkflowLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface WorkflowLogger {
  debug(data: Record<string, unknown>, message: string): void;
  info(data: Record<string, unknown>, message: string): void;
  warn(data: Record<string, unknown>, message: string): void;
  error(data: Record<string, unknown>, message: string): void;
}

/**
 * Create a workflow-safe logger for a specific component.
 *
 * Uses console.log/warn/error for output, which is compatible with
 * the Workflow DevKit runtime.
 *
 * @param component - The component/workflow name for log context
 */
export function createWorkflowLogger(component: string): WorkflowLogger {
  const formatLog = (level: WorkflowLogLevel, data: Record<string, unknown>, message: string) => {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      component,
      message,
      ...data,
    });
  };

  return {
    debug(data: Record<string, unknown>, message: string): void {
      // In workflows, debug logs are typically suppressed in production
      // but we still output them for development visibility
      console.log(formatLog('debug', data, message));
    },

    info(data: Record<string, unknown>, message: string): void {
      console.log(formatLog('info', data, message));
    },

    warn(data: Record<string, unknown>, message: string): void {
      console.warn(formatLog('warn', data, message));
    },

    error(data: Record<string, unknown>, message: string): void {
      console.error(formatLog('error', data, message));
    },
  };
}
