/**
 * Content sanitization utilities for XSS prevention.
 *
 * This module provides functions to sanitize user-generated content
 * before storing in the database or rendering in the UI.
 */

/**
 * HTML entities that need to be escaped to prevent XSS attacks.
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Regex pattern for matching HTML entities.
 */
const HTML_ENTITY_REGEX = /[&<>"'`=/]/g;

/**
 * Regex pattern for matching potentially dangerous URL schemes.
 */
const DANGEROUS_URL_SCHEMES = /^(javascript|data|vbscript):/i;

/**
 * Regex pattern for matching HTML tags.
 */
const HTML_TAG_REGEX = /<[^>]*>/g;

/**
 * Regex pattern for matching script-related content.
 */
const SCRIPT_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /on\w+\s*=/gi,
  /javascript:/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

/**
 * Escapes HTML entities in a string to prevent XSS attacks.
 * This is the primary sanitization function for plain text content.
 *
 * @example
 * escapeHtml('<script>alert("xss")</script>')
 * // Returns: '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str.replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Strips all HTML tags from a string.
 * Use this when you want plain text only with no formatting.
 *
 * @example
 * stripHtml('<p>Hello <strong>World</strong></p>')
 * // Returns: 'Hello World'
 */
export function stripHtml(str: string): string {
  if (!str || typeof str !== "string") {
    return "";
  }
  return str.replace(HTML_TAG_REGEX, "");
}

/**
 * Removes potentially dangerous content from a string.
 * This includes script tags, event handlers, and javascript: URLs.
 */
export function removeScriptContent(str: string): string {
  if (!str || typeof str !== "string") {
    return "";
  }

  let result = str;
  for (const pattern of SCRIPT_PATTERNS) {
    result = result.replace(pattern, "");
  }
  return result;
}

/**
 * Sanitizes a URL to prevent javascript: and other dangerous protocols.
 * Returns null for dangerous URLs.
 *
 * @example
 * sanitizeUrl('javascript:alert(1)') // Returns: null
 * sanitizeUrl('https://example.com') // Returns: 'https://example.com'
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmed = url.trim();

  // Check for dangerous schemes
  if (DANGEROUS_URL_SCHEMES.test(trimmed)) {
    return null;
  }

  // Decode and check again (prevents double-encoding attacks)
  try {
    const decoded = decodeURIComponent(trimmed);
    if (DANGEROUS_URL_SCHEMES.test(decoded)) {
      return null;
    }
  } catch {
    // If decoding fails, it might be malformed - allow it through
    // as the browser will also fail to decode it
  }

  // Ensure it's a valid URL for external links
  if (trimmed.startsWith("//") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      new URL(trimmed.startsWith("//") ? `https:${trimmed}` : trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  // Allow relative URLs
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) {
    return trimmed;
  }

  // For anything else, assume it needs a protocol
  try {
    new URL(`https://${trimmed}`);
    return trimmed;
  } catch {
    return null;
  }
}

/**
 * Sanitizes plain text content for safe storage and display.
 * Escapes HTML and removes control characters.
 */
export function sanitizeText(text: string | null | undefined): string {
  if (!text || typeof text !== "string") {
    return "";
  }

  // Remove null bytes and other control characters (except newlines and tabs)
  const cleaned = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Escape HTML entities
  return escapeHtml(cleaned);
}

/**
 * Sanitizes a title or name field.
 * Strips HTML, removes newlines, and trims.
 */
export function sanitizeTitle(title: string | null | undefined): string {
  if (!title || typeof title !== "string") {
    return "";
  }

  return stripHtml(title)
    .replace(/[\r\n]/g, " ") // Replace newlines with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Sanitizes a description or multi-line text field.
 * Strips HTML but preserves newlines.
 */
export function sanitizeDescription(description: string | null | undefined): string {
  if (!description || typeof description !== "string") {
    return "";
  }

  return stripHtml(description)
    .replace(/\r\n/g, "\n") // Normalize line endings
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .trim();
}

/**
 * Sanitizes a slug for URL usage.
 * Only allows lowercase letters, numbers, and hyphens.
 */
export function sanitizeSlug(slug: string | null | undefined): string {
  if (!slug || typeof slug !== "string") {
    return "";
  }

  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-") // Replace invalid chars with hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
    .replace(/^-|-$/g, ""); // Remove leading/trailing hyphens
}

/**
 * Sanitizes email address.
 * Basic validation and normalization.
 */
export function sanitizeEmail(email: string | null | undefined): string {
  if (!email || typeof email !== "string") {
    return "";
  }

  return email.toLowerCase().trim();
}

/**
 * Sanitizes comment content.
 * Allows limited formatting but strips dangerous content.
 */
export function sanitizeComment(content: string | null | undefined): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // Remove script content first
  let sanitized = removeScriptContent(content);

  // Strip all HTML tags
  sanitized = stripHtml(sanitized);

  // Normalize whitespace
  sanitized = sanitized
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return sanitized;
}

/**
 * Sanitizes code snippet content.
 * Escapes HTML but preserves code structure.
 */
export function sanitizeCode(code: string | null | undefined): string {
  if (!code || typeof code !== "string") {
    return "";
  }

  // Escape HTML entities to prevent XSS when rendering
  return escapeHtml(code);
}

/**
 * Sanitizes JSON metadata.
 * Recursively sanitizes string values.
 */
export function sanitizeMetadata(metadata: unknown): unknown {
  if (metadata === null || metadata === undefined) {
    return metadata;
  }

  if (typeof metadata === "string") {
    return sanitizeText(metadata);
  }

  if (Array.isArray(metadata)) {
    return metadata.map(sanitizeMetadata);
  }

  if (typeof metadata === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(metadata)) {
      result[sanitizeText(key)] = sanitizeMetadata(value);
    }
    return result;
  }

  return metadata;
}

/**
 * Object containing all sanitization functions for easy import.
 */
export const sanitizers = {
  html: escapeHtml,
  strip: stripHtml,
  url: sanitizeUrl,
  text: sanitizeText,
  title: sanitizeTitle,
  description: sanitizeDescription,
  slug: sanitizeSlug,
  email: sanitizeEmail,
  comment: sanitizeComment,
  code: sanitizeCode,
  metadata: sanitizeMetadata,
} as const;
