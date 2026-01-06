'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { createMention } from '@/lib/mentions';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    email: string;
  };
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  organizationId: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  onFocus?: () => void;
  rows?: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function MentionInput({
  value,
  onChange,
  organizationId,
  placeholder = 'Add a comment...',
  disabled = false,
  className,
  onFocus,
  rows = 3,
}: MentionInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [query, setQuery] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [mentionStartPosition, setMentionStartPosition] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [suggestionPosition, setSuggestionPosition] = useState({ top: 0, left: 0 });

  // Fetch members matching query
  const { data: membersData } = useSWR<{ success: boolean; data: Member[] }>(
    query.length > 0 ? `/api/organizations/${organizationId}/members?search=${encodeURIComponent(query)}` : null,
    fetcher,
  );

  const members = membersData?.data || [];

  // Calculate suggestion popup position
  const updateSuggestionPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Create a hidden div to measure text position
    const div = document.createElement('div');
    const styles = window.getComputedStyle(textarea);

    // Copy relevant styles
    div.style.position = 'absolute';
    div.style.visibility = 'hidden';
    div.style.whiteSpace = 'pre-wrap';
    div.style.wordWrap = 'break-word';
    div.style.width = styles.width;
    div.style.font = styles.font;
    div.style.padding = styles.padding;
    div.style.border = styles.border;
    div.style.lineHeight = styles.lineHeight;

    const textBeforeCursor = value.slice(0, cursorPosition);
    div.textContent = textBeforeCursor;

    document.body.appendChild(div);

    const _textareaRect = textarea.getBoundingClientRect();
    const divHeight = div.offsetHeight;

    document.body.removeChild(div);

    setSuggestionPosition({
      top: Math.min(divHeight, textarea.scrollHeight - textarea.scrollTop) + 4,
      left: 0,
    });
  }, [value, cursorPosition]);

  // Handle input changes
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = e.target.value;
      const cursor = e.target.selectionStart || 0;

      // Check if we're in a mention context
      const beforeCursor = text.slice(0, cursor);
      const mentionMatch = beforeCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        setQuery(mentionMatch[1]);
        setMentionStartPosition(cursor - mentionMatch[0].length);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setShowSuggestions(false);
        setQuery('');
      }

      setCursorPosition(cursor);
      onChange(text);
    },
    [onChange],
  );

  // Handle selection changes
  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target;
    if (target instanceof HTMLTextAreaElement) {
      setCursorPosition(target.selectionStart || 0);
    }
  }, []);

  // Insert mention at cursor position
  const insertMention = useCallback(
    (member: Member) => {
      if (!member.user.name) return;

      const beforeMention = value.slice(0, mentionStartPosition);
      const afterMention = value.slice(cursorPosition);
      const mention = createMention(member.user.name, member.userId);
      const newValue = `${beforeMention}${mention} ${afterMention}`;

      onChange(newValue);
      setShowSuggestions(false);
      setQuery('');

      // Focus and set cursor position after the mention
      setTimeout(() => {
        const textarea = textareaRef.current;
        if (textarea) {
          const newCursorPos = beforeMention.length + mention.length + 1;
          textarea.focus();
          textarea.setSelectionRange(newCursorPos, newCursorPos);
        }
      }, 0);
    },
    [value, mentionStartPosition, cursorPosition, onChange],
  );

  // Handle keyboard navigation in suggestions
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!showSuggestions || members.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % members.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + members.length) % members.length);
          break;
        case 'Enter':
          if (showSuggestions) {
            e.preventDefault();
            insertMention(members[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setShowSuggestions(false);
          break;
        case 'Tab':
          if (showSuggestions) {
            e.preventDefault();
            insertMention(members[selectedIndex]);
          }
          break;
      }
    },
    [showSuggestions, members, selectedIndex, insertMention],
  );

  // Update suggestion position when showing
  useEffect(() => {
    if (showSuggestions) {
      updateSuggestionPosition();
    }
  }, [showSuggestions, updateSuggestionPosition]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target;
      if (
        target instanceof Node &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(target) &&
        textareaRef.current &&
        !textareaRef.current.contains(target)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleInput}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onFocus={onFocus}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={cn('resize-none', className)}
      />
      {showSuggestions && members.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-64 bg-popover border rounded-md shadow-lg overflow-hidden"
          style={{ top: suggestionPosition.top, left: suggestionPosition.left }}
        >
          <div className="max-h-48 overflow-y-auto">
            {members.map((member: Member, index: number) => (
              <button
                key={member.id}
                type="button"
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-accent transition-colors',
                  index === selectedIndex && 'bg-accent',
                )}
                onClick={() => insertMention(member)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={member.user.image || undefined} alt={member.user.name || 'User'} />
                  <AvatarFallback className="text-xs">{member.user.name?.[0] || 'U'}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{member.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{member.user.email}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
