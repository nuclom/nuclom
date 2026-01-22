'use client';

import { cn } from '@nuclom/lib/utils';
import { AlertCircle, Bot, Database, User, WifiOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ConfidenceIndicator } from './confidence-indicator';
import { KnowledgeQASources, type QASource } from './knowledge-qa-sources';

export type ErrorType = 'network' | 'empty_knowledge_base' | 'rate_limit' | 'server' | 'unknown';

export interface KnowledgeQAMessageProps {
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  sources?: QASource[];
  errorType?: ErrorType;
}

function getErrorIcon(errorType: ErrorType) {
  switch (errorType) {
    case 'network':
      return <WifiOff className="h-4 w-4" />;
    case 'empty_knowledge_base':
      return <Database className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

export function KnowledgeQAMessage({ role, content, confidence, sources, errorType }: KnowledgeQAMessageProps) {
  const isUser = role === 'user';
  const isError = !!errorType;

  return (
    <div className={cn('flex gap-3 py-4', isUser ? 'justify-end' : 'justify-start')}>
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className={cn(isError ? 'bg-destructive/10' : 'bg-primary/10')}>
            {isError ? (
              <span className="text-destructive">{getErrorIcon(errorType)}</span>
            ) : (
              <Bot className="h-4 w-4 text-primary" />
            )}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={cn('flex flex-col gap-3 max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3',
            isUser
              ? 'bg-primary text-primary-foreground'
              : isError
                ? 'bg-destructive/5 border border-destructive/20'
                : 'bg-muted',
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{content}</p>
          ) : (
            <div className={cn('prose prose-sm dark:prose-invert max-w-none', isError && 'text-destructive')}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* Confidence indicator for assistant messages */}
        {!isUser && confidence !== undefined && <ConfidenceIndicator confidence={confidence} />}

        {/* Sources */}
        {!isUser && sources && sources.length > 0 && <KnowledgeQASources sources={sources} />}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="bg-primary">
            <User className="h-4 w-4 text-primary-foreground" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function KnowledgeQAMessageSkeleton() {
  return (
    <div className="flex gap-3 py-4">
      <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
      <div className="flex flex-col gap-2 flex-1 max-w-[85%]">
        <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
        <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}
