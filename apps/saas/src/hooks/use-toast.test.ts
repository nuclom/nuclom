import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the toast component types before import
vi.mock('@/components/ui/toast', () => ({
  ToastProps: {},
  ToastActionElement: {},
}));

import { reducer, toast, useToast } from './use-toast';

// Create a properly typed mock toast factory that satisfies ToasterToast requirements
// ToasterToast extends ToastProps which has optional fields
interface MockToastInput {
  id: string;
  title?: ReactNode;
  description?: ReactNode;
  open?: boolean;
  variant?: 'default' | 'destructive';
}

// Factory function creates toasts compatible with the reducer's expected type
function createMockToast(input: MockToastInput): Parameters<typeof reducer>[1] extends { toast: infer T } ? T : never {
  return {
    id: input.id,
    title: input.title,
    description: input.description,
    open: input.open ?? true,
    variant: input.variant,
    // ToastProps fields that may be required
    onOpenChange: () => {},
  } as Parameters<typeof reducer>[1] extends { toast: infer T } ? T : never;
}

describe('useToast', () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    // Clean up toasts after each test
    const { result } = renderHook(() => useToast());
    act(() => {
      result.current.dismiss();
    });
    vi.clearAllMocks();
  });

  describe('reducer', () => {
    const mockToastInput: MockToastInput = {
      id: '1',
      title: 'Test Toast',
      description: 'Test description',
      open: true,
    };

    it('should add a toast with ADD_TOAST action', () => {
      const state = { toasts: [] };
      const mockToast = createMockToast(mockToastInput);
      const newState = reducer(state, { type: 'ADD_TOAST', toast: mockToast });

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].id).toBe('1');
      expect(newState.toasts[0].title).toBe('Test Toast');
    });

    it('should respect TOAST_LIMIT when adding toasts', () => {
      const existingToast = createMockToast({ ...mockToastInput, id: 'existing' });
      const state = { toasts: [existingToast] };
      const mockToast = createMockToast(mockToastInput);
      const newState = reducer(state, { type: 'ADD_TOAST', toast: mockToast });

      // TOAST_LIMIT is 1, so the new toast should be first
      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].id).toBe('1');
    });

    it('should update a toast with UPDATE_TOAST action', () => {
      const mockToast = createMockToast(mockToastInput);
      const state = { toasts: [mockToast] };
      const newState = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: '1', title: 'Updated Title' },
      });

      expect(newState.toasts[0].title).toBe('Updated Title');
      expect(newState.toasts[0].description).toBe('Test description');
    });

    it('should not update non-existent toast', () => {
      const mockToast = createMockToast(mockToastInput);
      const state = { toasts: [mockToast] };
      const newState = reducer(state, {
        type: 'UPDATE_TOAST',
        toast: { id: 'non-existent', title: 'Updated Title' },
      });

      expect(newState.toasts[0].title).toBe('Test Toast');
    });

    it('should dismiss a specific toast with DISMISS_TOAST action', () => {
      const mockToast = createMockToast(mockToastInput);
      const state = { toasts: [mockToast] };
      const newState = reducer(state, {
        type: 'DISMISS_TOAST',
        toastId: '1',
      });

      expect(newState.toasts[0].open).toBe(false);
    });

    it('should dismiss all toasts when no toastId provided', () => {
      const toast1 = createMockToast({ ...mockToastInput, id: '1' });
      const toast2 = createMockToast({ ...mockToastInput, id: '2' });
      const state = { toasts: [toast1, toast2] };
      const newState = reducer(state, {
        type: 'DISMISS_TOAST',
      });

      expect(newState.toasts.every((t) => t.open === false)).toBe(true);
    });

    it('should remove a specific toast with REMOVE_TOAST action', () => {
      const mockToast = createMockToast(mockToastInput);
      const state = { toasts: [mockToast] };
      const newState = reducer(state, {
        type: 'REMOVE_TOAST',
        toastId: '1',
      });

      expect(newState.toasts).toHaveLength(0);
    });

    it('should remove all toasts when no toastId provided for REMOVE_TOAST', () => {
      const toast1 = createMockToast({ ...mockToastInput, id: '1' });
      const toast2 = createMockToast({ ...mockToastInput, id: '2' });
      const state = { toasts: [toast1, toast2] };
      const newState = reducer(state, {
        type: 'REMOVE_TOAST',
      });

      expect(newState.toasts).toHaveLength(0);
    });
  });

  describe('toast function', () => {
    it('should create a toast with provided props', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Test Toast', description: 'Test description' });
      });

      expect(result.current.toasts).toHaveLength(1);
      expect(result.current.toasts[0].title).toBe('Test Toast');
      expect(result.current.toasts[0].description).toBe('Test description');
    });

    it('should return dismiss and update functions', () => {
      let toastReturn: ReturnType<typeof toast> | undefined;

      act(() => {
        toastReturn = toast({ title: 'Test' });
      });

      expect(toastReturn?.dismiss).toBeDefined();
      expect(toastReturn?.update).toBeDefined();
      expect(toastReturn?.id).toBeDefined();
    });

    it('should update toast using returned update function', () => {
      const { result } = renderHook(() => useToast());
      let toastReturn: ReturnType<typeof toast> | undefined;

      act(() => {
        toastReturn = toast({ title: 'Original' });
      });

      act(() => {
        if (toastReturn) {
          // The update function accepts a partial ToasterToast with id
          toastReturn.update({ title: 'Updated', id: toastReturn.id, onOpenChange: () => {} });
        }
      });

      expect(result.current.toasts[0].title).toBe('Updated');
    });

    it('should dismiss toast using returned dismiss function', () => {
      const { result } = renderHook(() => useToast());
      let toastReturn: ReturnType<typeof toast> | undefined;

      act(() => {
        toastReturn = toast({ title: 'Test' });
      });

      act(() => {
        toastReturn?.dismiss();
      });

      expect(result.current.toasts[0].open).toBe(false);
    });
  });

  describe('useToast hook', () => {
    it('should return current toasts', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toasts).toBeDefined();
      expect(Array.isArray(result.current.toasts)).toBe(true);
    });

    it('should provide toast function', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.toast).toBeDefined();
      expect(typeof result.current.toast).toBe('function');
    });

    it('should provide dismiss function', () => {
      const { result } = renderHook(() => useToast());

      expect(result.current.dismiss).toBeDefined();
      expect(typeof result.current.dismiss).toBe('function');
    });

    it('should dismiss specific toast by id', () => {
      const { result } = renderHook(() => useToast());
      let toastId: string | undefined;

      act(() => {
        const toastReturn = toast({ title: 'Test' });
        toastId = toastReturn.id;
      });

      act(() => {
        if (toastId) {
          result.current.dismiss(toastId);
        }
      });

      expect(result.current.toasts[0].open).toBe(false);
    });

    it('should sync state across multiple hook instances', () => {
      const { result: result1 } = renderHook(() => useToast());
      const { result: result2 } = renderHook(() => useToast());

      act(() => {
        result1.current.toast({ title: 'Shared Toast' });
      });

      // Both hooks should see the same toast
      expect(result1.current.toasts[0].title).toBe('Shared Toast');
      expect(result2.current.toasts[0].title).toBe('Shared Toast');
    });

    it('should clean up listener on unmount', () => {
      const { result, unmount } = renderHook(() => useToast());

      act(() => {
        toast({ title: 'Test' });
      });

      expect(result.current.toasts).toHaveLength(1);

      unmount();

      // After unmount, a new hook should still work
      const { result: newResult } = renderHook(() => useToast());
      expect(newResult.current.toasts).toBeDefined();
    });
  });

  describe('toast variants', () => {
    it('should support destructive variant', () => {
      const { result } = renderHook(() => useToast());

      act(() => {
        toast({
          title: 'Error',
          description: 'Something went wrong',
          variant: 'destructive',
        });
      });

      expect(result.current.toasts[0].variant).toBe('destructive');
    });
  });
});
