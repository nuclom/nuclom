/**
 * Slack File Handlers
 *
 * Functions for downloading Slack files and uploading to storage.
 */

import { Effect } from 'effect';
import type { SlackFileAttachment } from '../../../../db/schema';
import { createLogger } from '../../../../logger';
import type { StorageService } from '../../storage';
import { MAX_FILE_SIZE_BYTES, SLACK_FILES_PREFIX } from './constants';
import type { SlackMessage } from './types';

const logger = createLogger('slack-file-handlers');

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
type SlackFile = NonNullable<SlackMessage['files']>[number];

export const processSlackFile = async (
  file: SlackFile,
  sourceId: string,
  accessToken: string,
  storage: StorageService,
): Promise<SlackFileAttachment> => {
  const fileId = file.id ?? 'unknown';
  const fileName = file.name ?? 'unknown';
  const fileMime = file.mimetype ?? 'application/octet-stream';
  const fileUrl = file.url_private ?? '';
  const fileSize = file.size ?? 0;

  // Log warning when using fallback values for critical fields
  if (!file.id) {
    logger.warn('Slack file missing ID, using fallback', { sourceId, fileName });
  }
  if (!file.name) {
    logger.warn('Slack file missing name, using fallback', { sourceId, fileId });
  }

  if (!fileUrl) {
    return {
      id: fileId,
      name: fileName,
      mimetype: fileMime,
      url: '',
      size: fileSize,
      skipped: true,
      skipReason: 'Missing Slack file URL',
    };
  }
  // Check file size limit
  if (fileSize > MAX_FILE_SIZE_BYTES) {
    return {
      id: fileId,
      name: fileName,
      mimetype: fileMime,
      url: fileUrl,
      size: fileSize,
      skipped: true,
      skipReason: `File exceeds ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`,
    };
  }

  // Check if storage is configured
  if (!storage.isConfigured) {
    return {
      id: fileId,
      name: fileName,
      mimetype: fileMime,
      url: fileUrl,
      size: fileSize,
      skipped: true,
      skipReason: 'Storage not configured',
    };
  }

  try {
    // Download the file from Slack
    const { buffer } = await downloadSlackFile(fileUrl, accessToken);

    // Generate storage key
    const storageKey = generateSlackFileKey(sourceId, fileId, fileName);

    // Upload to R2
    const uploadEffect = storage.uploadFile(buffer, storageKey, {
      contentType: file.mimetype ?? 'application/octet-stream',
      metadata: {
        sourceId,
        slackFileId: fileId,
        originalName: fileName,
      },
    });

    const exit = await Effect.runPromiseExit(uploadEffect);

    if (exit._tag === 'Success') {
      return {
        id: fileId,
        name: fileName,
        mimetype: fileMime,
        url: fileUrl,
        size: fileSize,
        storageKey,
      };
    } else {
      // Upload failed, return file without storage key
      const error = exit.cause;
      return {
        id: fileId,
        name: fileName,
        mimetype: fileMime,
        url: fileUrl,
        size: fileSize,
        skipped: true,
        skipReason: `Upload failed: ${error}`,
      };
    }
  } catch (error) {
    // Download or upload failed
    return {
      id: fileId,
      name: fileName,
      mimetype: fileMime,
      url: fileUrl,
      size: fileSize,
      skipped: true,
      skipReason: `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Process multiple Slack files concurrently
 */
export const processSlackFiles = async (
  files: SlackFile[] | undefined,
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
    return files.map((f) => {
      // Log warning for missing critical fields
      if (!f.id) {
        logger.warn('Slack file missing ID when storing metadata', { sourceId, fileName: f.name });
      }
      return {
        id: f.id ?? 'unknown',
        name: f.name ?? 'unknown',
        mimetype: f.mimetype ?? 'application/octet-stream',
        url: f.url_private ?? '',
        size: f.size ?? 0,
        skipped: true,
        skipReason: 'File sync disabled',
      };
    });
  }

  // Process files concurrently (limit concurrency to avoid rate limits)
  const results = await Promise.all(files.map((file) => processSlackFile(file, sourceId, accessToken, storage)));

  return results;
};
