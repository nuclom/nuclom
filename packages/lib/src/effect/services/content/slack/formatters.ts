/**
 * Slack Text Formatters
 *
 * Functions for resolving Slack mentions and formatting mrkdwn to plain text.
 */

import type { SlackUser } from '../../../../db/schema';

/**
 * Resolve Slack user mentions in text
 * Converts <@U123ABC> to @username
 */
export const resolveUserMentions = (text: string, users: Map<string, SlackUser>): string => {
  return text.replace(/<@([A-Z0-9]+)>/g, (match, userId) => {
    const user = users.get(userId);
    return user ? `@${user.displayName || user.realName || userId}` : match;
  });
};

/**
 * Resolve Slack channel mentions in text
 * Converts <#C123ABC|channel-name> or <#C123ABC> to #channel-name
 * When the channel name isn't in the mention, looks it up in the provided map
 */
export const resolveChannelMentions = (text: string, channels?: Map<string, string>): string => {
  return text.replace(/<#([A-Z0-9]+)(?:\|([^>]+))?>/g, (_match, id, name) => {
    if (name) {
      return `#${name}`;
    }
    const channelName = channels?.get(id);
    return channelName ? `#${channelName}` : `#${id}`;
  });
};

/**
 * Format Slack mrkdwn to plain text
 */
export const formatSlackMrkdwn = (
  text: string,
  users: Map<string, SlackUser>,
  channels?: Map<string, string>,
): string => {
  let formatted = text;

  // Resolve mentions
  formatted = resolveUserMentions(formatted, users);
  formatted = resolveChannelMentions(formatted, channels);

  // Convert links <url|text> to [text](url)
  formatted = formatted.replace(/<([^|>]+)\|([^>]+)>/g, '[$2]($1)');

  // Convert plain links <url> to url
  formatted = formatted.replace(/<([^>]+)>/g, '$1');

  // Convert bold *text* to **text**
  formatted = formatted.replace(/\*([^*]+)\*/g, '**$1**');

  // Convert code `text` stays as is
  // Convert code blocks ```text``` stays as is

  return formatted;
};
