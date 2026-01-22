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

  if (message.reply_count && message.reply_count > 0) {
    return `Thread: ${preview}${suffix} (${message.reply_count} replies)`;
  }
  return `${userName} in #${channel.name}: ${preview}${suffix}`;
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
  return `${userName} in #${channel.name}: ${preview}${suffix}${replySuffix}`;
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
  const user = users.get(message.user);
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
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      url: f.url_private,
      size: f.size,
    }));
  }

  const metadata: SlackMessageMetadata = {
    channel_id: channel.id,
    channel_name: channel.name,
    channel_type: channel.is_private ? 'private' : 'public',
    message_ts: message.ts,
    thread_ts: message.thread_ts,
    reactions: message.reactions,
    files: processedFiles,
    blocks: message.blocks,
    edited: message.edited,
    reply_count: message.reply_count,
    reply_users_count: message.reply_users_count,
    latest_reply: message.latest_reply,
    permalink,
  };

  return {
    externalId: message.ts,
    type: isThread ? 'thread' : 'message',
    title: generateMessageTitle(message, channel, user),
    content: resolvedContent,
    authorExternal: message.user,
    authorName: user?.realName || user?.displayName || message.user,
    createdAtSource: new Date(Number.parseFloat(message.ts) * 1000),
    updatedAtSource: message.edited ? new Date(Number.parseFloat(message.edited.ts) * 1000) : undefined,
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
  const allMessages = [parentMessage, ...replies.toSorted((a, b) => Number.parseFloat(a.ts) - Number.parseFloat(b.ts))];

  // Build readable content with resolved channel mentions
  const contentParts = allMessages.map((msg) => {
    const user = users.get(msg.user);
    const name = user?.realName || user?.displayName || 'Unknown';
    const time = new Date(Number.parseFloat(msg.ts) * 1000).toISOString();
    const resolvedText = msg.text ? resolveChannelMentions(msg.text, channels) : msg.text;
    return `**${name}** (${time}):\n${resolvedText}`;
  });
  const content = contentParts.join('\n\n---\n\n');

  // Extract participants
  const participantIds = [...new Set(allMessages.map((m) => m.user))];
  const participants = participantIds.map((id) => {
    const user = users.get(id);
    return {
      externalId: id,
      name: user?.realName || user?.displayName || 'Unknown',
      email: user?.email || undefined,
      role: id === parentMessage.user ? ('author' as const) : ('participant' as const),
    };
  });

  // Aggregate reactions
  const allReactions: Map<string, { count: number; users: Set<string> }> = new Map();
  for (const msg of allMessages) {
    if (msg.reactions) {
      for (const reaction of msg.reactions) {
        const existing = allReactions.get(reaction.name) || { count: 0, users: new Set<string>() };
        existing.count += reaction.count;
        for (const u of reaction.users) existing.users.add(u);
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
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      url: f.url_private,
      size: f.size,
    }));
  }

  const latestMessage = allMessages[allMessages.length - 1];
  const user = users.get(parentMessage.user);

  const metadata: SlackMessageMetadata = {
    channel_id: channel.id,
    channel_name: channel.name,
    channel_type: channel.is_private ? 'private' : 'public',
    message_ts: parentMessage.ts,
    thread_ts: parentMessage.ts,
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
    externalId: parentMessage.ts,
    type: 'thread',
    title: generateThreadTitle(parentMessage, channel, user, replies.length),
    content,
    authorExternal: parentMessage.user,
    authorName: user?.realName || user?.displayName || parentMessage.user,
    createdAtSource: new Date(Number.parseFloat(parentMessage.ts) * 1000),
    updatedAtSource: new Date(Number.parseFloat(latestMessage.ts) * 1000),
    metadata,
    participants,
  };
}
