'use client';

import { Bot, Loader2, MessageSquare } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { ChatContainer, ChatConversationList, type Conversation, type Message } from '@/components/chat';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface ConversationData {
  id: string;
  title: string | null;
  videoIds: string[] | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ConversationWithMessages extends ConversationData {
  messages: Message[];
}

interface ChatContentProps {
  organization: Organization;
  initialConversationId?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ChatSkeleton() {
  return (
    <div className="flex h-full">
      <div className="w-72 border-r">
        <div className="p-4 border-b">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="p-2 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    </div>
  );
}

export function ChatContent({ organization, initialConversationId }: ChatContentProps) {
  const router = useRouter();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId ?? null);

  // Update URL when conversation changes
  useEffect(() => {
    if (selectedConversationId && selectedConversationId !== initialConversationId) {
      router.push(`/org/${organization.slug}/chat?conversation=${selectedConversationId}`);
    }
  }, [selectedConversationId, initialConversationId, organization.slug, router]);

  // Fetch conversations list - NO waterfall since org is passed from server
  const {
    data: conversationsData,
    isLoading: isConversationsLoading,
    mutate: mutateConversations,
  } = useSWR<{ conversations: ConversationData[] }>(
    `/api/chat/conversations?organizationId=${organization.id}`,
    fetcher,
  );

  // Fetch selected conversation details with messages
  const { data: conversationData, isLoading: isConversationLoading } = useSWR<ConversationWithMessages>(
    selectedConversationId ? `/api/chat/conversations/${selectedConversationId}` : null,
    fetcher,
  );

  const conversations: Conversation[] = (conversationsData?.conversations ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    messageCount: c.messageCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedConversationId(id);
  }, []);

  const handleNewConversation = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: organization.id }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        mutateConversations();
        setSelectedConversationId(newConversation.id);
      }
    } catch (error) {
      console.error('Failed to create conversation:', error);
    }
  }, [organization.id, mutateConversations]);

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/chat/conversations/${id}`, {
          method: 'DELETE',
        });

        if (response.ok) {
          mutateConversations();
          if (selectedConversationId === id) {
            setSelectedConversationId(null);
            router.push(`/org/${organization.slug}/chat`);
          }
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error);
      }
    },
    [mutateConversations, selectedConversationId, organization.slug, router],
  );

  const handleRenameConversation = useCallback(
    async (id: string, title: string) => {
      try {
        const response = await fetch(`/api/chat/conversations/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title }),
        });

        if (response.ok) {
          mutateConversations();
        }
      } catch (error) {
        console.error('Failed to rename conversation:', error);
      }
    },
    [mutateConversations],
  );

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ResizablePanelGroup orientation="horizontal">
        {/* Conversation List Panel */}
        <ResizablePanel defaultSize={25} minSize={20} maxSize={35}>
          <ChatConversationList
            conversations={conversations}
            selectedId={selectedConversationId ?? undefined}
            onSelect={handleSelectConversation}
            onNew={handleNewConversation}
            onDelete={handleDeleteConversation}
            onRename={handleRenameConversation}
            isLoading={isConversationsLoading}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Chat Panel */}
        <ResizablePanel defaultSize={75}>
          {selectedConversationId ? (
            isConversationLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : conversationData ? (
              <ChatContainer
                conversationId={selectedConversationId}
                organizationId={organization.id}
                initialMessages={conversationData.messages.map((m) => ({
                  id: m.id,
                  role: m.role as 'user' | 'assistant' | 'system',
                  content: m.content,
                  sources: m.sources as Message['sources'],
                }))}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-muted-foreground">Failed to load conversation</p>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="rounded-full bg-primary/10 p-6 mb-6">
                <Bot className="h-12 w-12 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-3">AI Knowledge Base Chat</h2>
              <p className="text-muted-foreground max-w-md mb-6">
                Ask questions about your video content. I can search through transcripts, find decisions from meetings,
                and help you recall important discussions.
              </p>
              <button
                type="button"
                onClick={handleNewConversation}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Start a new conversation
              </button>
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
