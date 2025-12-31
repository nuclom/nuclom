/**
 * Mention parsing and rendering utilities
 *
 * Mention format: @[DisplayName](userId)
 * Example: @[John Doe](user_abc123) will be rendered as a clickable mention
 */

export interface MentionNode {
  type: "mention";
  name: string;
  userId: string;
}

export type ParsedContent = (string | MentionNode)[];

/**
 * Parse text content and extract mentions
 */
export function parseMentions(text: string): ParsedContent {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: ParsedContent = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec pattern
  while ((match = mentionRegex.exec(text)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the mention node
    parts.push({
      type: "mention",
      name: match[1],
      userId: match[2],
    });

    lastIndex = match.index + match[0].length;
  }

  // Add any remaining text after the last mention
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Extract user IDs from mentions in text
 */
export function extractMentionedUserIds(text: string): string[] {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  const userIds: string[] = [];
  let match: RegExpExecArray | null;

  // biome-ignore lint/suspicious/noAssignInExpressions: Standard regex exec pattern
  while ((match = mentionRegex.exec(text)) !== null) {
    userIds.push(match[2]);
  }

  return [...new Set(userIds)]; // Remove duplicates
}

/**
 * Create a mention string from user data
 */
export function createMention(name: string, userId: string): string {
  return `@[${name}](${userId})`;
}

/**
 * Check if text contains any mentions
 */
export function hasMentions(text: string): boolean {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/;
  return mentionRegex.test(text);
}

/**
 * Strip mentions from text, keeping only the display names with @ prefix
 */
export function stripMentionLinks(text: string): string {
  return text.replace(/@\[([^\]]+)\]\([^)]+\)/g, "@$1");
}

/**
 * Count the number of mentions in text
 */
export function countMentions(text: string): number {
  const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
  return (text.match(mentionRegex) || []).length;
}
