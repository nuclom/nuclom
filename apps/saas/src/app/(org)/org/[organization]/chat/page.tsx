import { db } from '@nuclom/lib/db';
import { organizations } from '@nuclom/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ChatContent, ChatSkeleton } from './chat-content';

interface PageProps {
  params: Promise<{ organization: string }>;
  searchParams: Promise<{ conversation?: string }>;
}

export default async function ChatPage({ params, searchParams }: PageProps) {
  const [{ organization: slug }, { conversation: conversationId }] = await Promise.all([params, searchParams]);

  // Fetch organization server-side - eliminates client-side waterfall
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
    columns: { id: true, name: true, slug: true },
  });

  if (!org) {
    notFound();
  }

  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatContent organization={org} initialConversationId={conversationId} />
    </Suspense>
  );
}
