'use client';

import { logger } from '@nuclom/lib/client-logger';
import { Bot, Loader2, MessageSquare } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { ChatContainer, ChatConversationList, type Conversation, type Message } from '@/components/chat';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';

interface OrganizationData {
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

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function ChatSkeleton() {
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

function ChatContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const organizationSlug = params.organization as string;

  const conversationIdParam = searchParams.get('conversation');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(conversationIdParam);

  // Update URL when conversation changes
  useEffect(() => {
    if (selectedConversationId && selectedConversationId !== conversationIdParam) {
      router.push(`/org/${organizationSlug}/chat?conversation=${selectedConversationId}`);
    }
  }, [selectedConversationId, conversationIdParam, organizationSlug, router]);

  // First fetch organization by slug
  const { data: orgData, isLoading: isOrgLoading } = useSWR<{ success: boolean; data: OrganizationData }>(
    `/api/organizations/slug/${organizationSlug}`,
    fetcher,
  );

  const organization = orgData?.data;
  const organizationId = organization?.id;

  // Fetch conversations list
  const {
    data: conversationsData,
    isLoading: isConversationsLoading,
    mutate: mutateConversations,
  } = useSWR<{ conversations: ConversationData[] }>(
    organizationId ? `/api/chat/conversations?organizationId=${organizationId}` : null,
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
    if (!organizationId) return;

    try {
      const response = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });

      if (response.ok) {
        const newConversation = await response.json();
        mutateConversations();
        setSelectedConversationId(newConversation.id);
      }
    } catch (error) {
      logger.error('Failed to create new conversation', error);
    }
  }, [organizationId, mutateConversations]);

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
            router.push(`/org/${organizationSlug}/chat`);
          }
        }
      } catch (error) {
        logger.error('Failed to delete conversation', error);
      }
    },
    [mutateConversations, selectedConversationId, organizationSlug, router],
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
        logger.error('Failed to rename conversation', error);
      }
    },
    [mutateConversations],
  );

  if (isOrgLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
            ) : conversationData && organizationId ? (
              <ChatContainer
                conversationId={selectedConversationId}
                organizationId={organizationId}
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

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent />
    </Suspense>
  );
}
