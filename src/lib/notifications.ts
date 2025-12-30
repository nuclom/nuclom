/**
 * Notification Utilities
 *
 * Provides consistent toast notifications for user feedback.
 * Uses sonner for toast display with consistent styling.
 */

import { toast } from "sonner";
import { type ErrorCode, getErrorMessage } from "@/lib/api-errors";

// =============================================================================
// Success Notifications
// =============================================================================

interface SuccessOptions {
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

/**
 * Show a success toast notification
 */
export function showSuccess(message: string, options?: SuccessOptions): void {
  toast.success(message, {
    description: options?.description,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration ?? 4000,
  });
}

/**
 * Pre-defined success messages for common actions
 */
export const successMessages = {
  // CRUD operations
  created: (entity: string) => `${entity} created successfully`,
  updated: (entity: string) => `${entity} updated successfully`,
  deleted: (entity: string) => `${entity} deleted successfully`,
  saved: (entity?: string) => (entity ? `${entity} saved successfully` : "Changes saved"),

  // Auth
  loggedIn: "Welcome back!",
  loggedOut: "You have been logged out",
  passwordChanged: "Password changed successfully",
  passwordReset: "Password reset email sent",

  // Video
  videoUploaded: "Video uploaded successfully",
  videoProcessing: "Video is processing...",

  // Organization
  memberInvited: "Invitation sent successfully",
  memberRemoved: "Member removed from organization",
  roleUpdated: "Member role updated",

  // Settings
  settingsSaved: "Settings saved successfully",
  profileUpdated: "Profile updated successfully",

  // Generic
  copied: "Copied to clipboard",
  linkCopied: "Link copied to clipboard",
} as const;

// =============================================================================
// Error Notifications
// =============================================================================

interface ErrorOptions {
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

/**
 * Show an error toast notification
 */
export function showError(message: string, options?: ErrorOptions): void {
  toast.error(message, {
    description: options?.description,
    action: options?.action
      ? {
          label: options.action.label,
          onClick: options.action.onClick,
        }
      : undefined,
    duration: options?.duration ?? 5000,
  });
}

/**
 * Show an error toast from an API error code
 */
export function showApiError(code: ErrorCode, customMessage?: string): void {
  const message = customMessage ?? getErrorMessage(code);
  showError(message);
}

// =============================================================================
// Info/Warning Notifications
// =============================================================================

/**
 * Show an info toast notification
 */
export function showInfo(message: string, description?: string): void {
  toast.info(message, { description, duration: 4000 });
}

/**
 * Show a warning toast notification
 */
export function showWarning(message: string, description?: string): void {
  toast.warning(message, { description, duration: 5000 });
}

// =============================================================================
// Loading/Promise Notifications
// =============================================================================

interface PromiseToastMessages {
  loading: string;
  success: string;
  error: string;
}

/**
 * Show a toast that tracks a promise
 * Updates automatically when the promise resolves or rejects
 */
export function showPromiseToast<T>(promise: Promise<T>, messages: PromiseToastMessages): Promise<T> {
  toast.promise(promise, {
    loading: messages.loading,
    success: messages.success,
    error: messages.error,
  });
  return promise;
}

/**
 * Show a loading toast that can be dismissed or updated
 */
export function showLoadingToast(message: string): string | number {
  return toast.loading(message);
}

/**
 * Dismiss a specific toast by ID
 */
export function dismissToast(toastId: string | number): void {
  toast.dismiss(toastId);
}

/**
 * Dismiss all toasts
 */
export function dismissAllToasts(): void {
  toast.dismiss();
}

// =============================================================================
// Confirmation Toasts (with actions)
// =============================================================================

interface ConfirmOptions {
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  duration?: number;
}

/**
 * Show a confirmation toast with action buttons
 */
export function showConfirmation(message: string, description: string, options: ConfirmOptions): void {
  toast(message, {
    description,
    duration: options.duration ?? 10000,
    action: {
      label: options.confirmLabel ?? "Confirm",
      onClick: options.onConfirm,
    },
    cancel: {
      label: options.cancelLabel ?? "Cancel",
      onClick: options.onCancel ?? (() => {}),
    },
  });
}

// =============================================================================
// Async Action Helpers
// =============================================================================

/**
 * Execute an async action with automatic success/error toasts
 *
 * @example
 * ```tsx
 * await withFeedback(
 *   () => deleteVideo(id),
 *   {
 *     loading: "Deleting video...",
 *     success: "Video deleted",
 *     error: "Failed to delete video",
 *   }
 * );
 * ```
 */
export async function withFeedback<T>(action: () => Promise<T>, messages: PromiseToastMessages): Promise<T | null> {
  const toastId = showLoadingToast(messages.loading);

  try {
    const result = await action();
    toast.dismiss(toastId);
    showSuccess(messages.success);
    return result;
  } catch (error) {
    toast.dismiss(toastId);
    const errorMessage = error instanceof Error ? error.message : messages.error;
    showError(errorMessage);
    return null;
  }
}

/**
 * Copy text to clipboard with feedback
 */
export async function copyToClipboard(text: string, successMessage?: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    showSuccess(successMessage ?? successMessages.copied);
    return true;
  } catch {
    showError("Failed to copy to clipboard");
    return false;
  }
}
