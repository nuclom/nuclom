/**
 * Slack File Handlers
 *
 * Functions for downloading Slack files and uploading to storage.
 */

import { Effect } from 'effect';
import type { SlackFileAttachment } from '../../../../db/schema';
import type { StorageService } from '../../storage';
import { MAX_FILE_SIZE_BYTES, SLACK_FILES_PREFIX } from './constants';

/**
 * Download a file from Slack using the bot token
 */
export const downloadSlackFile = async (
  fileUrl: string,
  accessToken: string,
): Promise<{ buffer: Buffer; contentType: string }> => {
  const response = await fetch(fileUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return { buffer, contentType };
};

/**
 * Generate a storage key for a Slack file
 * Format: slack-files/{sourceId}/{fileId}/{filename}
 */
export const generateSlackFileKey = (sourceId: string, fileId: string, filename: string): string => {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
  return `${SLACK_FILES_PREFIX}/${sourceId}/${fileId}/${sanitizedFilename}`;
};

/**
 * Process a single Slack file: download and upload to R2
 * Returns the file attachment with storage key if successful
 */
export const processSlackFile = async (
  file: { id: string; name: string; mimetype: string; url_private: string; size: number },
  sourceId: string,
  accessToken: string,
  storage: StorageService,
): Promise<SlackFileAttachment> => {
  // Check file size limit
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      url: file.url_private,
      size: file.size,
      skipped: true,
      skipReason: `File exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
    };
  }

  // Check if storage is configured
  if (!storage.isConfigured) {
    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      url: file.url_private,
      size: file.size,
      skipped: true,
      skipReason: 'Storage not configured',
    };
  }

  try {
    // Download the file from Slack
    const { buffer } = await downloadSlackFile(file.url_private, accessToken);

    // Generate storage key
    const storageKey = generateSlackFileKey(sourceId, file.id, file.name);

    // Upload to R2
    const uploadEffect = storage.uploadFile(buffer, storageKey, {
      contentType: file.mimetype,
      metadata: {
        sourceId,
        slackFileId: file.id,
        originalName: file.name,
      },
    });

    const exit = await Effect.runPromiseExit(uploadEffect);

    if (exit._tag === 'Success') {
      return {
        id: file.id,
        name: file.name,
        mimetype: file.mimetype,
        url: file.url_private,
        size: file.size,
        storageKey,
      };
    } else {
      // Upload failed, return file without storage key
      const error = exit.cause;
      return {
        id: file.id,
        name: file.name,
        mimetype: file.mimetype,
        url: file.url_private,
        size: file.size,
        skipped: true,
        skipReason: `Upload failed: ${error}`,
      };
    }
  } catch (error) {
    // Download or upload failed
    return {
      id: file.id,
      name: file.name,
      mimetype: file.mimetype,
      url: file.url_private,
      size: file.size,
      skipped: true,
      skipReason: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Process multiple Slack files concurrently
 */
export const processSlackFiles = async (
  files: Array<{ id: string; name: string; mimetype: string; url_private: string; size: number }> | undefined,
  sourceId: string,
  accessToken: string,
  storage: StorageService,
  syncFiles: boolean,
): Promise<SlackFileAttachment[] | undefined> => {
  if (!files || files.length === 0) {
    return undefined;
  }

  // If syncFiles is disabled, just store metadata without downloading
  if (!syncFiles) {
    return files.map((f) => ({
      id: f.id,
      name: f.name,
      mimetype: f.mimetype,
      url: f.url_private,
      size: f.size,
      skipped: true,
      skipReason: 'File sync disabled',
    }));
  }

  // Process files concurrently (limit concurrency to avoid rate limits)
  const results = await Promise.all(files.map((file) => processSlackFile(file, sourceId, accessToken, storage)));

  return results;
};
