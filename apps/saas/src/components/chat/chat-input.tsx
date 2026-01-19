'use client';

import { cn } from '@nuclom/lib/utils';
import { ArrowUp, Loader2, Square } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

export interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function ChatInput({
  value,
  onChange,
  onSubmit,
  onStop,
  isLoading = false,
  placeholder = 'Ask about your video content...',
  disabled = false,
  className,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally triggering resize when value changes
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && !isLoading && value.trim()) {
        onSubmit();
      }
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!disabled && !isLoading && value.trim()) {
      onSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cn('relative flex items-end gap-2 p-2 border rounded-2xl bg-background shadow-sm', className)}
    >
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled || isLoading}
        rows={1}
        className={cn(
          'min-h-[44px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent py-3 px-3',
          'placeholder:text-muted-foreground/70',
        )}
      />

      <div className="flex items-center gap-1 pb-1.5 pr-1">
        {isLoading && onStop ? (
          <Button type="button" size="icon" variant="destructive" className="h-9 w-9 rounded-xl" onClick={onStop}>
            <Square className="h-4 w-4" />
            <span className="sr-only">Stop generating</span>
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            className="h-9 w-9 rounded-xl"
            disabled={disabled || isLoading || !value.trim()}
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            <span className="sr-only">Send message</span>
          </Button>
        )}
      </div>
    </form>
  );
}
