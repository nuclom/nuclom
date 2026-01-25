'use client';

import { cn } from '@nuclom/lib/utils';
import { Button } from '@nuclom/ui/button';
import { ScrollArea } from '@nuclom/ui/scroll-area';
import { Textarea } from '@nuclom/ui/textarea';
import { MessageSquareText, Send, StopCircle } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { FollowUpChips } from './follow-up-chips';
import { KnowledgeQAMessage, KnowledgeQAMessageSkeleton } from './knowledge-qa-message';

export interface QASource {
  contentId: string;
  type: 'content_item' | 'decision' | 'transcript_chunk';
  title: string;
  similarity: number;
  excerpt: string;
  sourceType?: string;
  url?: string;
}

export interface QAResult {
  answer: string;
  confidence: number;
  sources: QASource[];
  followUpQuestions: string[];
}

type ErrorType = 'network' | 'empty_knowledge_base' | 'rate_limit' | 'server' | 'unknown';

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  confidence?: number;
  sources?: QASource[];
  followUpQuestions?: string[];
  errorType?: ErrorType;
}

function getErrorMessage(error: unknown): { message: string; type: ErrorType } {
  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return {
      type: 'network',
      message: "I couldn't connect to the server. Please check your internet connection and try again.",
    };
  }

  // Check for specific HTTP error responses
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('429') || message.includes('rate limit')) {
      return {
        type: 'rate_limit',
        message: "You're asking questions too quickly. Please wait a moment and try again.",
      };
    }

    if (message.includes('404') || message.includes('not found')) {
      return {
        type: 'empty_knowledge_base',
        message:
          'Your knowledge base appears to be empty. Try adding some content sources like Slack, Notion, or documents first.',
      };
    }

    if (message.includes('500') || message.includes('server')) {
      return {
        type: 'server',
        message: 'Something went wrong on our end. Our team has been notified. Please try again in a few minutes.',
      };
    }
  }

  return {
    type: 'unknown',
    message:
      "I couldn't find an answer to your question. Try rephrasing your question or check if the relevant content has been added to your knowledge base.",
  };
}

export interface KnowledgeQAContainerProps {
  organizationId: string;
  className?: string;
}

export function KnowledgeQAContainer({ organizationId, className }: KnowledgeQAContainerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  const handleSubmit = useCallback(
    async (question?: string) => {
      const q = question || input.trim();
      if (!q || isLoading) return;

      const userMessage: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        content: q,
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput('');
      setIsLoading(true);

      abortControllerRef.current = new AbortController();

      try {
        const response = await fetch('/api/ai/qa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            question: q,
            options: { limit: 10 },
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get answer');
        }

        const result: QAResult = await response.json();

        const assistantMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.answer,
          confidence: result.confidence,
          sources: result.sources,
          followUpQuestions: result.followUpQuestions,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        setTimeout(scrollToBottom, 100);
      } catch (error) {
        if (!isAbortError(error)) {
          const errorMessage = getErrorMessage(error);
          const errorMsg: Message = {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: errorMessage.message,
            errorType: errorMessage.type,
          };
          setMessages((prev) => [...prev, errorMsg]);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, organizationId, scrollToBottom],
  );

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleFollowUpClick = useCallback(
    (question: string) => {
      handleSubmit(question);
    },
    [handleSubmit],
  );

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-4 pb-4 max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-100 text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <MessageSquareText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Ask your Knowledge Base</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask questions about decisions, discussions, and documents from your team. Get answers with sources from
                Slack, Notion, GitHub, and more.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => (
                <div key={message.id}>
                  <KnowledgeQAMessage
                    role={message.role}
                    content={message.content}
                    confidence={message.confidence}
                    sources={message.sources}
                    errorType={message.errorType}
                  />
                  {message.role === 'assistant' &&
                    message.followUpQuestions &&
                    message.followUpQuestions.length > 0 &&
                    index === messages.length - 1 && (
                      <FollowUpChips questions={message.followUpQuestions} onClick={handleFollowUpClick} />
                    )}
                </div>
              ))}

              {isLoading && <KnowledgeQAMessageSkeleton />}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4 bg-background">
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your team's knowledge..."
              className="min-h-20 pr-12 resize-none"
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2">
              {isLoading ? (
                <Button variant="ghost" size="icon" onClick={handleStop}>
                  <StopCircle className="h-5 w-5 text-destructive" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => handleSubmit()} disabled={!input.trim()}>
                  <Send className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
