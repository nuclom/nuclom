import { describe, expect, it } from 'vitest';
import type { CreateVideoInput, UpdateVideoInput, VideoRepositoryService } from './video-repository';

describe('VideoRepository Types', () => {
  describe('CreateVideoInput', () => {
    it('should have required fields', () => {
      const input: CreateVideoInput = {
        title: 'Test Video',
        duration: '10:30',
        authorId: 'user-123',
        organizationId: 'org-123',
      };

      expect(input.title).toBe('Test Video');
      expect(input.duration).toBe('10:30');
      expect(input.authorId).toBe('user-123');
      expect(input.organizationId).toBe('org-123');
    });

    it('should support optional fields', () => {
      const input: CreateVideoInput = {
        title: 'Test Video',
        duration: '10:30',
        authorId: 'user-123',
        organizationId: 'org-123',
        description: 'A test description',
        thumbnailUrl: '/thumb.jpg',
        videoUrl: '/video.mp4',
        transcript: 'Test transcript',
        processingStatus: 'pending',
        aiSummary: 'AI summary',
        aiTags: ['tag1', 'tag2'],
      };

      expect(input.description).toBe('A test description');
      expect(input.thumbnailUrl).toBe('/thumb.jpg');
      expect(input.videoUrl).toBe('/video.mp4');
      expect(input.aiTags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('UpdateVideoInput', () => {
    it('should allow partial updates', () => {
      const input: UpdateVideoInput = {
        title: 'Updated Title',
      };

      expect(input.title).toBe('Updated Title');
      expect(input.description).toBeUndefined();
    });

    it('should allow null values for optional fields', () => {
      const input: UpdateVideoInput = {
        description: null,
        thumbnailUrl: null,
        videoUrl: null,
      };

      expect(input.description).toBeNull();
      expect(input.thumbnailUrl).toBeNull();
    });
  });

  describe('VideoRepositoryService interface', () => {
    it('should define all required methods', () => {
      // This test verifies the interface structure at compile time
      const mockService: VideoRepositoryService = {
        getVideos: () => {
          throw new Error('Mock');
        },
        getDeletedVideos: () => {
          throw new Error('Mock');
        },
        getVideo: () => {
          throw new Error('Mock');
        },
        createVideo: () => {
          throw new Error('Mock');
        },
        updateVideo: () => {
          throw new Error('Mock');
        },
        softDeleteVideo: () => {
          throw new Error('Mock');
        },
        restoreVideo: () => {
          throw new Error('Mock');
        },
        deleteVideo: () => {
          throw new Error('Mock');
        },
        cleanupExpiredVideos: () => {
          throw new Error('Mock');
        },
        getVideoChapters: () => {
          throw new Error('Mock');
        },
        searchVideos: () => {
          throw new Error('Mock');
        },
        getVideosByAuthor: () => {
          throw new Error('Mock');
        },
        getVideosSharedByOthers: () => {
          throw new Error('Mock');
        },
        canAccessVideo: () => {
          throw new Error('Mock');
        },
        getAccessibleVideos: () => {
          throw new Error('Mock');
        },
      };

      expect(mockService.getVideos).toBeDefined();
      expect(mockService.getDeletedVideos).toBeDefined();
      expect(mockService.getVideo).toBeDefined();
      expect(mockService.createVideo).toBeDefined();
      expect(mockService.updateVideo).toBeDefined();
      expect(mockService.softDeleteVideo).toBeDefined();
      expect(mockService.restoreVideo).toBeDefined();
      expect(mockService.deleteVideo).toBeDefined();
      expect(mockService.cleanupExpiredVideos).toBeDefined();
      expect(mockService.getVideoChapters).toBeDefined();
      expect(mockService.searchVideos).toBeDefined();
    });
  });
});
