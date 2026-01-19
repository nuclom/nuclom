import { describe, expect, it } from 'vitest';
import type { ContentProcessorService, ContentSourceAdapter, SyncProgress } from './types';

describe('ContentProcessor Types', () => {
  describe('ContentSourceAdapter interface', () => {
    it('should define required methods', () => {
      const mockAdapter: ContentSourceAdapter = {
        sourceType: 'slack',
        validateCredentials: () => {
          throw new Error('Mock');
        },
        fetchContent: () => {
          throw new Error('Mock');
        },
        fetchItem: () => {
          throw new Error('Mock');
        },
        refreshAuth: undefined,
      };

      expect(mockAdapter.sourceType).toBe('slack');
      expect(mockAdapter.validateCredentials).toBeDefined();
      expect(mockAdapter.fetchContent).toBeDefined();
      expect(mockAdapter.fetchItem).toBeDefined();
    });

    it('should support all source types', () => {
      const types: ContentSourceAdapter['sourceType'][] = [
        'video',
        'slack',
        'notion',
        'github',
        'google_drive',
        'confluence',
        'linear',
      ];

      for (const type of types) {
        const adapter: ContentSourceAdapter = {
          sourceType: type,
          validateCredentials: () => {
            throw new Error('Mock');
          },
          fetchContent: () => {
            throw new Error('Mock');
          },
          fetchItem: () => {
            throw new Error('Mock');
          },
        };
        expect(adapter.sourceType).toBe(type);
      }
    });

    it('should support optional refreshAuth method', () => {
      const adapterWithRefresh: ContentSourceAdapter = {
        sourceType: 'slack',
        validateCredentials: () => {
          throw new Error('Mock');
        },
        fetchContent: () => {
          throw new Error('Mock');
        },
        fetchItem: () => {
          throw new Error('Mock');
        },
        refreshAuth: () => {
          throw new Error('Mock');
        },
      };

      expect(adapterWithRefresh.refreshAuth).toBeDefined();
    });
  });

  describe('SyncProgress', () => {
    it('should track sync progress', () => {
      const progress: SyncProgress = {
        sourceId: 'source-123',
        status: 'syncing',
        itemsProcessed: 50,
        totalItems: 100,
        startedAt: new Date(),
      };

      expect(progress.sourceId).toBe('source-123');
      expect(progress.status).toBe('syncing');
      expect(progress.itemsProcessed).toBe(50);
      expect(progress.totalItems).toBe(100);
    });

    it('should support all sync statuses', () => {
      const statuses: SyncProgress['status'][] = ['pending', 'syncing', 'completed', 'failed'];

      for (const status of statuses) {
        const progress: SyncProgress = {
          sourceId: 'source-123',
          status,
          itemsProcessed: 0,
          startedAt: new Date(),
        };
        expect(progress.status).toBe(status);
      }
    });

    it('should support error tracking', () => {
      const progress: SyncProgress = {
        sourceId: 'source-123',
        status: 'failed',
        itemsProcessed: 25,
        totalItems: 100,
        startedAt: new Date(),
        error: 'API rate limit exceeded',
      };

      expect(progress.error).toBe('API rate limit exceeded');
    });

    it('should track completion time', () => {
      const now = new Date();
      const progress: SyncProgress = {
        sourceId: 'source-123',
        status: 'completed',
        itemsProcessed: 100,
        totalItems: 100,
        startedAt: now,
        completedAt: new Date(now.getTime() + 60000),
      };

      expect(progress.completedAt).toBeDefined();
    });
  });

  describe('ContentProcessorService interface', () => {
    it('should define all required methods', () => {
      const mockService: ContentProcessorService = {
        registerAdapter: () => {
          throw new Error('Mock');
        },
        syncSource: () => {
          throw new Error('Mock');
        },
        getSyncProgress: () => {
          throw new Error('Mock');
        },
        processItem: () => {
          throw new Error('Mock');
        },
        processItemsBatch: () => {
          throw new Error('Mock');
        },
      };

      expect(mockService.registerAdapter).toBeDefined();
      expect(mockService.syncSource).toBeDefined();
      expect(mockService.getSyncProgress).toBeDefined();
      expect(mockService.processItem).toBeDefined();
      expect(mockService.processItemsBatch).toBeDefined();
    });
  });

  describe('AdapterFetchOptions', () => {
    it('should support pagination options', () => {
      const options = {
        limit: 50,
        cursor: 'next-page-token',
      };

      expect(options.limit).toBe(50);
      expect(options.cursor).toBe('next-page-token');
    });

    it('should support time range filtering', () => {
      const options = {
        since: new Date('2024-01-01'),
        until: new Date('2024-12-31'),
      };

      expect(options.since).toBeInstanceOf(Date);
      expect(options.until).toBeInstanceOf(Date);
    });
  });

  describe('AdapterFetchResult', () => {
    it('should return items with pagination info', () => {
      const result = {
        items: [
          { externalId: '1', type: 'message' as const, title: 'Test' },
          { externalId: '2', type: 'message' as const, title: 'Test 2' },
        ],
        nextCursor: 'cursor-123',
        hasMore: true,
      };

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('cursor-123');
      expect(result.hasMore).toBe(true);
    });

    it('should indicate end of results', () => {
      const result = {
        items: [{ externalId: '1', type: 'message' as const }],
        hasMore: false,
      };

      expect(result.nextCursor).toBeUndefined();
      expect(result.hasMore).toBe(false);
    });
  });

  describe('RawContentItem', () => {
    it('should have required fields', () => {
      const item = {
        externalId: 'msg-123',
        type: 'message' as const,
      };

      expect(item.externalId).toBe('msg-123');
      expect(item.type).toBe('message');
    });

    it('should support all item types', () => {
      const types = ['video', 'message', 'thread', 'document', 'issue', 'pull_request', 'comment', 'file'] as const;

      for (const type of types) {
        const item = { externalId: '123', type };
        expect(item.type).toBe(type);
      }
    });

    it('should support optional metadata', () => {
      const item = {
        externalId: 'video-123',
        type: 'video' as const,
        title: 'Engineering Standup',
        content: 'Transcript text...',
        createdAtSource: new Date(),
        metadata: {
          duration: 1800,
          videoUrl: 'https://storage.example.com/video.mp4',
        },
        tags: ['meeting', 'engineering'],
        participants: [{ externalId: 'user-1', name: 'John Doe', role: 'speaker' as const }],
      };

      expect(item.title).toBe('Engineering Standup');
      expect(item.content).toBe('Transcript text...');
      expect(item.metadata).toEqual({
        duration: 1800,
        videoUrl: 'https://storage.example.com/video.mp4',
      });
      expect(item.tags).toContain('meeting');
      expect(item.participants?.[0].name).toBe('John Doe');
    });
  });
});
