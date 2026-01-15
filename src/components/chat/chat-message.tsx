'use client';

import { Bot, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export interface ChatMessageProps {
  messageRole: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming?: boolean;
  sources?: Array<{
    type: string;
    id: string;
    relevance: number;
    preview?: string;
    videoId?: string;
    timestamp?: number;
  }>;
  userName?: string;
  userImage?: string;
}

export function ChatMessage({
  messageRole,
  content,
  isStreaming = false,
  sources,
  userName,
  userImage,
}: ChatMessageProps) {
  const isUser = messageRole === 'user';

  return (
    <div className={cn('flex gap-3 py-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary/10">
            <Bot className="h-4 w-4 text-primary" />
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-2 max-w-[80%]', isUser ? 'items-end' : 'items-start')}>
        <div className={cn('rounded-2xl px-4 py-3', isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              {isStreaming && <span className="inline-block w-2 h-4 ml-1 bg-current animate-pulse" />}
            </div>
          )}
        </div>

        {/* Sources display */}
        {sources && sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {sources.map((source, index) => (
              <span
                key={`${source.type}-${source.id}-${index}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-secondary text-secondary-foreground"
                title={source.preview}
              >
                <span className="font-medium">{source.type === 'decision' ? 'Decision' : 'Transcript'}</span>
                <span className="opacity-60">{source.relevance}%</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarImage src={userImage} alt={userName} />
          <AvatarFallback className="bg-primary">
            <User className="h-4 w-4 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function ChatMessageSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      <div className="flex flex-col gap-2 flex-1">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}
