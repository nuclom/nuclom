'use client';

import { cn } from '@nuclom/lib/utils';
import { MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatInput } from './chat-input';
import { ChatMessage, ChatMessageSkeleton } from './chat-message';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{
    type: string;
    id: string;
    relevance: number;
    preview?: string;
    videoId?: string;
    timestamp?: number;
  }>;
}

export interface ChatContainerProps {
  conversationId: string;
  organizationId: string;
  initialMessages?: Message[];
  onMessageSent?: (message: Message) => void;
  userName?: string;
  userImage?: string;
  className?: string;
}

interface StreamEvent {
  type: 'chunk' | 'source' | 'done' | 'error';
  content?: string;
  source?: {
    type: string;
    id: string;
    relevance: number;
    preview?: string;
    videoId?: string;
    timestamp?: number;
  };
  messageId?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  error?: string;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

export function ChatContainer({
  conversationId,
  organizationId: _organizationId,
  initialMessages = [],
  onMessageSent,
  userName,
  userImage,
  className,
}: ChatContainerProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingSources, setStreamingSources] = useState<Message['sources']>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Scroll to bottom when messages change
  // biome-ignore lint/correctness/useExhaustiveDependencies: Intentionally triggering scroll on message/content changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent.length]);

  const handleSubmit = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStreamingContent('');
    setStreamingSources([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: userMessage.content,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let accumulatedContent = '';
      const accumulatedSources: Message['sources'] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: StreamEvent = JSON.parse(line.slice(6));

              if (event.type === 'chunk' && event.content) {
                accumulatedContent += event.content;
                setStreamingContent(accumulatedContent);
              } else if (event.type === 'source' && event.source) {
                accumulatedSources.push(event.source);
                setStreamingSources([...accumulatedSources]);
              } else if (event.type === 'done') {
                // Finalize the assistant message
                const assistantMessage: Message = {
                  id: event.messageId ?? crypto.randomUUID(),
                  role: 'assistant',
                  content: accumulatedContent,
                  sources: accumulatedSources,
                };
                setMessages((prev) => [...prev, assistantMessage]);
                setStreamingContent('');
                setStreamingSources([]);
                onMessageSent?.(assistantMessage);
              } else if (event.type === 'error') {
                throw new Error(event.error ?? 'Unknown error');
              }
            } catch (e) {
              // Ignore parse errors for incomplete chunks
              if (e instanceof SyntaxError) continue;
              throw e;
            }
          }
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        // User stopped the generation
        if (streamingContent) {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: `${streamingContent}\n\n*[Generation stopped]*`,
              sources: streamingSources,
            },
          ]);
        }
      } else {
        // Show error message
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Sorry, an error occurred while generating a response. Please try again.',
          },
        ]);
      }
      setStreamingContent('');
      setStreamingSources([]);
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [conversationId, input, isLoading, streamingContent, streamingSources, onMessageSent]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Messages area */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="px-4 pb-4">
          {messages.length === 0 && !streamingContent ? (
            <div className="flex flex-col items-center justify-center h-[400px] text-center">
              <div className="rounded-full bg-primary/10 p-4 mb-4">
                <MessageSquare className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Ask questions about your video content. I can search through transcripts, decisions, and key moments
                from your meetings.
              </p>
            </div>
          ) : (
            <>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  messageRole={message.role}
                  content={message.content}
                  sources={message.sources}
                  userName={userName}
                  userImage={userImage}
                />
              ))}

              {/* Streaming message */}
              {streamingContent && (
                <ChatMessage
                  messageRole="assistant"
                  content={streamingContent}
                  isStreaming={true}
                  sources={streamingSources}
                />
              )}

              {/* Loading indicator */}
              {isLoading && !streamingContent && <ChatMessageSkeleton />}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Input area */}
      <div className="border-t p-4 bg-background">
        <ChatInput
          value={input}
          onChange={setInput}
          onSubmit={handleSubmit}
          onStop={handleStop}
          isLoading={isLoading}
          placeholder="Ask about your video content..."
        />
      </div>
    </div>
  );
}
