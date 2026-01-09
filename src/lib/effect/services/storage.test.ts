/**
 * Storage Service Tests
 *
 * Tests the Storage service using Effect-TS patterns with mocked service.
 */

import { Effect, Exit, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { DeleteError, PresignedUrlError, UploadError } from '../errors';
import { Storage, type StorageService, type UploadResult } from './storage';

describe('Storage Service', () => {
  // Create a mock storage service for testing
  const createMockStorageService = (isConfigured = true): StorageService => ({
    uploadFile: vi.fn().mockImplementation((_buffer, key, _options) =>
      isConfigured
        ? Effect.succeed({
            key,
            url: `https://storage.example.com/${key}`,
            etag: 'mock-etag',
          } as UploadResult)
        : Effect.fail(new UploadError({ message: 'Storage not configured', filename: key })),
    ),

    uploadLargeFile: vi.fn().mockImplementation((_buffer, key, _options, onProgress) => {
      if (!isConfigured) {
        return Effect.fail(new UploadError({ message: 'Storage not configured', filename: key }));
      }
      // Simulate progress callback
      if (onProgress) {
        onProgress({ loaded: 512, total: 1024 });
      }
      return Effect.succeed({
        key,
        url: `https://storage.example.com/${key}`,
        etag: 'large-file-etag',
      } as UploadResult);
    }),

    deleteFile: vi
      .fn()
      .mockImplementation((key) =>
        isConfigured ? Effect.void : Effect.fail(new DeleteError({ message: 'Storage not configured', key })),
      ),

    generatePresignedUploadUrl: vi
      .fn()
      .mockImplementation((key, _contentType, expiresIn) =>
        isConfigured
          ? Effect.succeed(`https://storage.example.com/presigned/${key}?expires=${expiresIn ?? 3600}`)
          : Effect.fail(new PresignedUrlError({ message: 'Storage not configured' })),
      ),

    generatePresignedDownloadUrl: vi
      .fn()
      .mockImplementation((key, expiresIn) =>
        isConfigured
          ? Effect.succeed(`https://storage.example.com/download/${key}?expires=${expiresIn ?? 3600}`)
          : Effect.fail(new PresignedUrlError({ message: 'Storage not configured' })),
      ),

    extractKeyFromUrl: vi.fn().mockImplementation((url) => {
      const parts = url.split('.r2.cloudflarestorage.com/');
      return parts.length === 2 ? parts[1] : null;
    }),

    generateFileKey: vi.fn().mockImplementation((organizationId, filename, type = 'video') => {
      const timestamp = Date.now();
      const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
      return `${organizationId}/${type}s/${timestamp}-${sanitizedFilename}`;
    }),

    isConfigured,
  });

  const createTestLayer = (service: StorageService) => Layer.succeed(Storage, service);

  describe('with configured storage', () => {
    describe('uploadFile', () => {
      it('should upload a file successfully', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);
        const buffer = Buffer.from('test content');

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.uploadFile(buffer, 'test/file.txt', {
            contentType: 'text/plain',
          });
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result.key).toBe('test/file.txt');
        expect(result.url).toContain('test/file.txt');
        expect(result.etag).toBe('mock-etag');
      });

      it('should handle upload errors', async () => {
        const mockService = createMockStorageService();
        (mockService as { uploadFile: unknown }).uploadFile = vi
          .fn()
          .mockImplementation(() => Effect.fail(new UploadError({ message: 'Upload failed', filename: 'test.txt' })));
        const testLayer = createTestLayer(mockService);
        const buffer = Buffer.from('test');

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.uploadFile(buffer, 'test/fail.txt');
        });

        const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

        expect(Exit.isFailure(exit)).toBe(true);
      });
    });

    describe('uploadLargeFile', () => {
      it('should upload a large file with progress tracking', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);
        const progressCallback = vi.fn();
        const buffer = Buffer.alloc(1024);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.uploadLargeFile(
            buffer,
            'test/large-file.bin',
            { contentType: 'application/octet-stream' },
            progressCallback,
          );
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result.key).toBe('test/large-file.bin');
        expect(result.etag).toBe('large-file-etag');
      });
    });

    describe('deleteFile', () => {
      it('should delete a file successfully', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.deleteFile('test/file-to-delete.txt');
        });

        await Effect.runPromise(Effect.provide(program, testLayer));

        expect(mockService.deleteFile).toHaveBeenCalledWith('test/file-to-delete.txt');
      });

      it('should handle delete errors', async () => {
        const mockService = createMockStorageService();
        (mockService as { deleteFile: unknown }).deleteFile = vi
          .fn()
          .mockImplementation(() => Effect.fail(new DeleteError({ message: 'Delete failed', key: 'test.txt' })));
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.deleteFile('test/nonexistent.txt');
        });

        const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

        expect(Exit.isFailure(exit)).toBe(true);
      });
    });

    describe('generatePresignedUploadUrl', () => {
      it('should generate a presigned URL', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.generatePresignedUploadUrl('test/upload-target.mp4', 'video/mp4', 3600);
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toContain('test/upload-target.mp4');
        expect(result).toContain('expires=3600');
      });

      it('should use default expiry when not provided', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.generatePresignedUploadUrl('test/file.mp4', 'video/mp4');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toContain('expires=3600');
      });

      it('should handle presigned URL errors', async () => {
        const mockService = createMockStorageService();
        (mockService as { generatePresignedUploadUrl: unknown }).generatePresignedUploadUrl = vi
          .fn()
          .mockImplementation(() => Effect.fail(new PresignedUrlError({ message: 'Signing failed' })));
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.generatePresignedUploadUrl('test/file.mp4', 'video/mp4');
        });

        const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

        expect(Exit.isFailure(exit)).toBe(true);
      });
    });

    describe('generatePresignedDownloadUrl', () => {
      it('should generate a presigned download URL', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.generatePresignedDownloadUrl('test/file.mp4', 3600);
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toContain('test/file.mp4');
        expect(result).toContain('download');
      });
    });

    describe('extractKeyFromUrl', () => {
      it('should extract the key from a valid R2 URL', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.extractKeyFromUrl('https://bucket.account.r2.cloudflarestorage.com/org-123/videos/file.mp4');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toBe('org-123/videos/file.mp4');
      });

      it('should return null for invalid URLs', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.extractKeyFromUrl('https://example.com/file.mp4');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toBeNull();
      });
    });

    describe('generateFileKey', () => {
      it('should generate a unique file key for videos', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.generateFileKey('org-123', 'my-video.mp4', 'video');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toContain('org-123');
        expect(result).toContain('videos');
        expect(result).toContain('my-video.mp4');
      });

      it('should generate a unique file key for thumbnails', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.generateFileKey('org-123', 'thumb.jpg', 'thumbnail');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toContain('thumbnails');
      });

      it('should sanitize filenames', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.generateFileKey('org-123', 'my file (1).mp4', 'video');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).not.toContain(' ');
        expect(result).not.toContain('(');
        expect(result).not.toContain(')');
      });

      it('should use video as default type', async () => {
        const mockService = createMockStorageService();
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.generateFileKey('org-123', 'file.mp4');
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toContain('videos');
      });
    });

    describe('isConfigured', () => {
      it('should return true when storage is configured', async () => {
        const mockService = createMockStorageService(true);
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.isConfigured;
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toBe(true);
      });
    });
  });

  describe('with unconfigured storage', () => {
    describe('uploadFile', () => {
      it('should fail with appropriate error', async () => {
        const mockService = createMockStorageService(false);
        const testLayer = createTestLayer(mockService);
        const buffer = Buffer.from('test');

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.uploadFile(buffer, 'test/file.txt');
        });

        const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

        expect(Exit.isFailure(exit)).toBe(true);
      });
    });

    describe('deleteFile', () => {
      it('should fail with appropriate error', async () => {
        const mockService = createMockStorageService(false);
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.deleteFile('test/file.txt');
        });

        const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

        expect(Exit.isFailure(exit)).toBe(true);
      });
    });

    describe('generatePresignedUploadUrl', () => {
      it('should fail with appropriate error', async () => {
        const mockService = createMockStorageService(false);
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return yield* storage.generatePresignedUploadUrl('test/file.mp4', 'video/mp4');
        });

        const exit = await Effect.runPromiseExit(Effect.provide(program, testLayer));

        expect(Exit.isFailure(exit)).toBe(true);
      });
    });

    describe('isConfigured', () => {
      it('should return false when storage is not configured', async () => {
        const mockService = createMockStorageService(false);
        const testLayer = createTestLayer(mockService);

        const program = Effect.gen(function* () {
          const storage = yield* Storage;
          return storage.isConfigured;
        });

        const result = await Effect.runPromise(Effect.provide(program, testLayer));

        expect(result).toBe(false);
      });
    });
  });
});
