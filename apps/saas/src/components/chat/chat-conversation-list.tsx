'use client';

import { formatDistanceToNow } from 'date-fns';
import { Edit2, MessageSquare, MoreVertical, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ChatConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, title: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function ChatConversationList({
  conversations,
  selectedId,
  onSelect,
  onNew,
  onDelete,
  onRename,
  isLoading = false,
  className,
}: ChatConversationListProps) {
  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <h2 className="font-semibold">Conversations</h2>
        <Button size="sm" onClick={onNew} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((conversation) => (
                <ConversationItem
                  key={conversation.id}
                  conversation={conversation}
                  isSelected={conversation.id === selectedId}
                  onSelect={() => onSelect(conversation.id)}
                  onDelete={onDelete ? () => onDelete(conversation.id) : undefined}
                  onRename={onRename}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  onRename?: (id: string, title: string) => void;
}

function ConversationItem({ conversation, isSelected, onSelect, onDelete, onRename }: ConversationItemProps) {
  const title = conversation.title || 'New conversation';
  const updatedAt = new Date(conversation.updatedAt);

  return (
    <button
      type="button"
      className={cn(
        'group flex items-center gap-2 rounded-lg p-2 cursor-pointer transition-colors w-full text-left',
        isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted',
      )}
      onClick={onSelect}
    >
      <MessageSquare className="h-4 w-4 shrink-0" />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        <p className="text-xs text-muted-foreground">
          {conversation.messageCount} messages &middot; {formatDistanceToNow(updatedAt, { addSuffix: true })}
        </p>
      </div>

      {(onDelete || onRename) && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onRename && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const newTitle = prompt('Enter new title:', conversation.title ?? '');
                  if (newTitle?.trim()) {
                    onRename(conversation.id, newTitle.trim());
                  }
                }}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                Rename
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm('Delete this conversation?')) {
                    onDelete();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </button>
  );
}
