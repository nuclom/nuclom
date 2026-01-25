'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nuclom/ui/alert-dialog';
import { Input } from '@nuclom/ui/input';
import { Label } from '@nuclom/ui/label';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';
import { type ReactNode, useCallback, useState } from 'react';

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  /** Text that user must type to confirm (for dangerous actions) */
  confirmText?: string;
  /** Placeholder text showing what to type */
  confirmPlaceholder?: string;
  /** Label for the confirm button */
  actionLabel?: string;
  /** Callback when confirmed */
  onConfirm: () => void | Promise<void>;
  /** Whether the action is currently in progress */
  isLoading?: boolean;
  /** Type of action - affects styling */
  variant?: 'destructive' | 'warning' | 'default';
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmPlaceholder,
  actionLabel = 'Confirm',
  onConfirm,
  isLoading = false,
  variant = 'destructive',
}: ConfirmDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const requiresConfirmation = !!confirmText;
  const isConfirmed = !requiresConfirmation || inputValue === confirmText;

  const handleConfirm = useCallback(async () => {
    if (!isConfirmed || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
      setInputValue('');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [isConfirmed, isSubmitting, onConfirm, onOpenChange]);

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!newOpen) {
        setInputValue('');
      }
      onOpenChange(newOpen);
    },
    [onOpenChange],
  );

  const Icon = variant === 'destructive' ? Trash2 : AlertTriangle;
  const iconBgColor = variant === 'destructive' ? 'bg-destructive/10' : 'bg-amber-100';
  const iconColor = variant === 'destructive' ? 'text-destructive' : 'text-amber-600';

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-start gap-4">
            <div className={`rounded-full p-2 ${iconBgColor}`}>
              <Icon className={`h-5 w-5 ${iconColor}`} />
            </div>
            <div className="flex-1">
              <AlertDialogTitle className="text-left">{title}</AlertDialogTitle>
              <AlertDialogDescription className="text-left mt-2">{description}</AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {requiresConfirmation && (
          <div className="space-y-2 mt-4">
            <Label htmlFor="confirm-input" className="text-sm">
              Type <span className="font-mono font-semibold text-foreground">{confirmText}</span> to confirm
            </Label>
            <Input
              id="confirm-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={confirmPlaceholder || `Type "${confirmText}" to confirm`}
              className="font-mono"
              autoComplete="off"
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel disabled={isLoading || isSubmitting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmed || isLoading || isSubmitting}
            className={
              variant === 'destructive'
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : variant === 'warning'
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : ''
            }
          >
            {isLoading || isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Please wait...
              </>
            ) : (
              actionLabel
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook to easily use the confirm dialog in components
 */
export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'> | null;
  }>({
    open: false,
    props: null,
  });

  const confirm = useCallback((props: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'>) => {
    setDialogState({ open: true, props });
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    setDialogState((prev) => ({ ...prev, open }));
  }, []);

  const dialog = dialogState.props ? (
    <ConfirmDialog {...dialogState.props} open={dialogState.open} onOpenChange={handleOpenChange} />
  ) : null;

  return { confirm, dialog };
}
