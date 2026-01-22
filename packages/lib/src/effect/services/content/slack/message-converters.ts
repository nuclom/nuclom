/**
 * Slack Message Converters
 *
 * Functions for converting Slack messages to RawContentItem format.
 */

import type { SlackFileAttachment, SlackMessageMetadata, SlackUser } from '../../../../db/schema';
import type { RawContentItem } from '../types';
import { processSlackFiles } from './file-handlers';
import { resolveChannelMentions } from './formatters';
import type { MessageProcessingContext, SlackChannelInfo, SlackMessage } from './types';

/**
 * Generate a title for a Slack message
 */
export function generateMessageTitle(message: SlackMessage, channel: SlackChannelInfo, user?: SlackUser): string {
  const userName = user?.realName || user?.displayName || 'Unknown';
  const preview = message.text?.slice(0, 50) || '';
  const suffix = message.text && message.text.length > 50 ? '...' : '';
  const channelName = channel.name ?? 'unknown';

  if (message.reply_count && message.reply_count > 0) {
    return `Thread: ${preview}${suffix} (${message.reply_count} replies)`;
  }
  return `${userName} in #${channelName}: ${preview}${suffix}`;
}

/**
 * Generate a title for a thread
 */
export function generateThreadTitle(
  parentMessage: SlackMessage,
  channel: SlackChannelInfo,
  user?: SlackUser,
  replyCount?: number,
): string {
  const userName = user?.realName || user?.displayName || 'Unknown';
  const preview = parentMessage.text?.slice(0, 40) || 'Discussion';
  const suffix = parentMessage.text && parentMessage.text.length > 40 ? '...' : '';
  const replySuffix = replyCount ? ` (${replyCount} replies)` : '';
  const channelName = channel.name ?? 'unknown';
  return `${userName} in #${channelName}: ${preview}${suffix}${replySuffix}`;
}

/**
 * Convert a Slack message to a RawContentItem
 * Optionally downloads and stores file attachments if context is provided
 */
export async function messageToRawContentItem(
  message: SlackMessage,
  channel: SlackChannelInfo,
  users: Map<string, SlackUser>,
  permalink?: string,
  processingContext?: MessageProcessingContext,
  channels?: Map<string, string>,
): Promise<RawContentItem> {
  const messageUser = message.user ?? message.bot_id ?? 'unknown';
  const user = users.get(messageUser);
  const messageTs = message.ts ?? '0';
  const isThread = message.reply_count && message.reply_count > 0;

  // Resolve channel mentions in the message text
  const resolvedContent = message.text ? resolveChannelMentions(message.text, channels) : message.text;

  // Process files if context is available
  let processedFiles: SlackFileAttachment[] | undefined;
  if (processingContext && message.files && message.files.length > 0) {
    processedFiles = await processSlackFiles(
      message.files,
      processingContext.sourceId,
      processingContext.accessToken,
      processingContext.storage,
      processingContext.syncFiles,
    );
  } else if (message.files) {
    // No processing context, just store metadata
    processedFiles = message.files.map((f) => ({
      id: f.id ?? 'unknown',
      name: f.name ?? 'unknown',
      mimetype: f.mimetype ?? 'application/octet-stream',
      url: f.url_private ?? '',
      size: f.size ?? 0,
    }));
  }

  const reactions =
    message.reactions?.flatMap((reaction) => {
      if (!reaction.name) {
        return [];
      }
      return [
        {
          name: reaction.name,
          count: reaction.count ?? 0,
          users: reaction.users ?? [],
        },
      ];
    }) ?? undefined;

  const edited =
    message.edited?.user && message.edited.ts ? { user: message.edited.user, ts: message.edited.ts } : undefined;

  const metadata: SlackMessageMetadata = {
    channel_id: channel.id ?? 'unknown',
    channel_name: channel.name ?? 'unknown',
    channel_type: channel.is_private ? 'private' : 'public',
    message_ts: messageTs,
    thread_ts: message.thread_ts ?? undefined,
    reactions,
    files: processedFiles,
    blocks: message.blocks,
    edited,
    reply_count: message.reply_count,
    reply_users_count: message.reply_users_count,
    latest_reply: message.latest_reply,
    permalink,
  };

  return {
    externalId: messageTs,
    type: isThread ? 'thread' : 'message',
    title: generateMessageTitle(message, channel, user),
    content: resolvedContent,
    authorExternal: messageUser,
    authorName: user?.realName || user?.displayName || messageUser,
    createdAtSource: new Date(Number.parseFloat(messageTs) * 1000),
    updatedAtSource: message.edited?.ts ? new Date(Number.parseFloat(message.edited.ts) * 1000) : undefined,
    metadata,
    participants: user
      ? [
          {
            externalId: user.slackUserId,
            name: user.realName || user.displayName,
            email: user.email || undefined,
            role: 'author' as const,
          },
        ]
      : undefined,
  };
}

/**
 * Aggregate thread messages into a single content item
 * Optionally downloads and stores file attachments if context is provided
 */
export async function aggregateThread(
  parentMessage: SlackMessage,
  replies: SlackMessage[],
  channel: SlackChannelInfo,
  users: Map<string, SlackUser>,
  permalink?: string,
  processingContext?: MessageProcessingContext,
  channels?: Map<string, string>,
): Promise<RawContentItem> {
  const parentUser = parentMessage.user ?? parentMessage.bot_id ?? 'unknown';
  const allMessages = [
    parentMessage,
    ...replies.toSorted((a, b) => Number.parseFloat(a.ts ?? '0') - Number.parseFloat(b.ts ?? '0')),
  ];

  // Build readable content with resolved channel mentions
  const contentParts = allMessages.map((msg) => {
    const messageUser = msg.user ?? msg.bot_id ?? 'unknown';
    const user = users.get(messageUser);
    const name = user?.realName || user?.displayName || 'Unknown';
    const time = new Date(Number.parseFloat(msg.ts ?? '0') * 1000).toISOString();
    const resolvedText = msg.text ? resolveChannelMentions(msg.text, channels) : msg.text;
    return `**${name}** (${time}):\n${resolvedText}`;
  });
  const content = contentParts.join('\n\n---\n\n');

  // Extract participants
  const participantIds = [
    ...new Set(allMessages.map((m) => m.user ?? m.bot_id ?? 'unknown').filter((id): id is string => !!id)),
  ];
  const participants = participantIds.map((id) => {
    const user = users.get(id);
    return {
      externalId: id,
      name: user?.realName || user?.displayName || 'Unknown',
      email: user?.email || undefined,
      role: id === parentUser ? ('author' as const) : ('participant' as const),
    };
  });

  // Aggregate reactions
  const allReactions: Map<string, { count: number; users: Set<string> }> = new Map();
  for (const msg of allMessages) {
    if (msg.reactions) {
      for (const reaction of msg.reactions) {
        if (!reaction.name) {
          continue;
        }
        const existing = allReactions.get(reaction.name) || { count: 0, users: new Set<string>() };
        existing.count += reaction.count ?? 0;
        for (const u of reaction.users ?? []) existing.users.add(u);
        allReactions.set(reaction.name, existing);
      }
    }
  }

  // Collect all files from all messages
  const allFilesRaw = allMessages.flatMap((m) => m.files || []);

  // Process files if context is available
  let processedFiles: SlackFileAttachment[] | undefined;
  if (processingContext && allFilesRaw.length > 0) {
    processedFiles = await processSlackFiles(
      allFilesRaw,
      processingContext.sourceId,
      processingContext.accessToken,
      processingContext.storage,
      processingContext.syncFiles,
    );
  } else if (allFilesRaw.length > 0) {
    // No processing context, just store metadata
    processedFiles = allFilesRaw.map((f) => ({
      id: f.id ?? 'unknown',
      name: f.name ?? 'unknown',
      mimetype: f.mimetype ?? 'application/octet-stream',
      url: f.url_private ?? '',
      size: f.size ?? 0,
    }));
  }

  const latestMessage = allMessages[allMessages.length - 1];
  const user = users.get(parentUser);

  const metadata: SlackMessageMetadata = {
    channel_id: channel.id ?? 'unknown',
    channel_name: channel.name ?? 'unknown',
    channel_type: channel.is_private ? 'private' : 'public',
    message_ts: parentMessage.ts ?? '0',
    thread_ts: parentMessage.ts ?? '0',
    reactions: Array.from(allReactions.entries()).map(([name, data]) => ({
      name,
      count: data.count,
      users: Array.from(data.users),
    })),
    files: processedFiles,
    reply_count: replies.length,
    reply_users_count: participantIds.length,
    permalink,
  };

  return {
    externalId: parentMessage.ts ?? '0',
    type: 'thread',
    title: generateThreadTitle(parentMessage, channel, user, replies.length),
    content,
    authorExternal: parentUser,
    authorName: user?.realName || user?.displayName || parentUser,
    createdAtSource: new Date(Number.parseFloat(parentMessage.ts ?? '0') * 1000),
    updatedAtSource: new Date(Number.parseFloat(latestMessage.ts ?? '0') * 1000),
    metadata,
    participants,
  };
}
