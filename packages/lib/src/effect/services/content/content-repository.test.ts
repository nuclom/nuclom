import { describe, expect, it } from 'vitest';
import type {
  ContentItem,
  ContentParticipant,
  ContentRelationship,
  ContentRepositoryService,
  ContentSource,
  CreateContentItemInput,
  CreateContentParticipantInput,
  CreateContentRelationshipInput,
  CreateContentSourceInput,
  UpdateContentItemInput,
  UpdateContentSourceInput,
} from './types';

describe('ContentRepository Types', () => {
  describe('CreateContentSourceInput', () => {
    it('should have required fields', () => {
      const input: CreateContentSourceInput = {
        organizationId: 'org-123',
        type: 'video',
        name: 'Video Recordings',
      };

      expect(input.organizationId).toBe('org-123');
      expect(input.type).toBe('video');
      expect(input.name).toBe('Video Recordings');
    });

    it('should support optional config and credentials', () => {
      const input: CreateContentSourceInput = {
        organizationId: 'org-123',
        type: 'slack',
        name: 'Engineering Slack',
        config: { channelIds: ['C123', 'C456'] },
        credentials: { accessToken: 'xoxb-123' },
      };

      expect(input.config).toEqual({ channelIds: ['C123', 'C456'] });
      expect(input.credentials).toEqual({ accessToken: 'xoxb-123' });
    });

    it('should support all source types', () => {
      const types: CreateContentSourceInput['type'][] = [
        'video',
        'slack',
        'notion',
        'github',
        'google_drive',
        'confluence',
        'linear',
      ];

      for (const type of types) {
        const input: CreateContentSourceInput = {
          organizationId: 'org-123',
          type,
          name: `${type} Source`,
        };
        expect(input.type).toBe(type);
      }
    });
  });

  describe('UpdateContentSourceInput', () => {
    it('should allow partial updates', () => {
      const input: UpdateContentSourceInput = {
        name: 'Updated Name',
      };

      expect(input.name).toBe('Updated Name');
    });

    it('should support sync status updates', () => {
      const input: UpdateContentSourceInput = {
        syncStatus: 'syncing',
        lastSyncAt: new Date(),
      };

      expect(input.syncStatus).toBe('syncing');
    });
  });

  describe('CreateContentItemInput', () => {
    it('should have required fields', () => {
      const input: CreateContentItemInput = {
        organizationId: 'org-123',
        sourceId: 'source-123',
        type: 'video',
        externalId: 'video-abc',
      };

      expect(input.organizationId).toBe('org-123');
      expect(input.sourceId).toBe('source-123');
      expect(input.type).toBe('video');
      expect(input.externalId).toBe('video-abc');
    });

    it('should support all content item types', () => {
      const types: CreateContentItemInput['type'][] = [
        'video',
        'message',
        'thread',
        'document',
        'issue',
        'pull_request',
        'comment',
        'file',
      ];

      for (const type of types) {
        const input: CreateContentItemInput = {
          organizationId: 'org-123',
          sourceId: 'source-123',
          type,
          externalId: `${type}-123`,
        };
        expect(input.type).toBe(type);
      }
    });

    it('should support optional content fields', () => {
      const input: CreateContentItemInput = {
        organizationId: 'org-123',
        sourceId: 'source-123',
        type: 'video',
        externalId: 'video-123',
        title: 'My Video',
        content: 'Transcript text...',
        summary: 'Video summary',
        tags: ['meeting', 'engineering'],
        metadata: { duration: 3600 },
      };

      expect(input.title).toBe('My Video');
      expect(input.content).toBe('Transcript text...');
      expect(input.summary).toBe('Video summary');
      expect(input.tags).toEqual(['meeting', 'engineering']);
      expect(input.metadata).toEqual({ duration: 3600 });
    });
  });

  describe('UpdateContentItemInput', () => {
    it('should allow partial updates', () => {
      const input: UpdateContentItemInput = {
        title: 'Updated Title',
        processingStatus: 'completed',
      };

      expect(input.title).toBe('Updated Title');
      expect(input.processingStatus).toBe('completed');
    });

    it('should support all processing statuses', () => {
      const statuses: UpdateContentItemInput['processingStatus'][] = [
        'pending',
        'processing',
        'completed',
        'failed',
        'skipped',
      ];

      for (const status of statuses) {
        const input: UpdateContentItemInput = {
          processingStatus: status,
        };
        expect(input.processingStatus).toBe(status);
      }
    });
  });

  describe('CreateContentRelationshipInput', () => {
    it('should have required fields', () => {
      const input: CreateContentRelationshipInput = {
        sourceItemId: 'item-1',
        targetItemId: 'item-2',
        relationshipType: 'references',
      };

      expect(input.sourceItemId).toBe('item-1');
      expect(input.targetItemId).toBe('item-2');
      expect(input.relationshipType).toBe('references');
    });

    it('should support all relationship types', () => {
      const types: CreateContentRelationshipInput['relationshipType'][] = [
        'references',
        'replies_to',
        'implements',
        'supersedes',
        'relates_to',
        'mentions',
        'derived_from',
      ];

      for (const type of types) {
        const input: CreateContentRelationshipInput = {
          sourceItemId: 'item-1',
          targetItemId: 'item-2',
          relationshipType: type,
        };
        expect(input.relationshipType).toBe(type);
      }
    });

    it('should support optional fields', () => {
      const input: CreateContentRelationshipInput = {
        sourceItemId: 'item-1',
        targetItemId: 'item-2',
        relationshipType: 'references',
        confidence: 0.95,
        metadata: { context: 'explicit mention' },
      };

      expect(input.confidence).toBe(0.95);
      expect(input.metadata).toEqual({ context: 'explicit mention' });
    });
  });

  describe('CreateContentParticipantInput', () => {
    it('should have required fields', () => {
      const input: CreateContentParticipantInput = {
        contentItemId: 'item-123',
        name: 'John Doe',
      };

      expect(input.contentItemId).toBe('item-123');
      expect(input.name).toBe('John Doe');
    });

    it('should support all participant roles', () => {
      const roles: CreateContentParticipantInput['role'][] = [
        'author',
        'speaker',
        'participant',
        'mentioned',
        'assignee',
        'reviewer',
      ];

      for (const role of roles) {
        const input: CreateContentParticipantInput = {
          contentItemId: 'item-123',
          name: 'John Doe',
          role,
        };
        expect(input.role).toBe(role);
      }
    });

    it('should support optional user linking', () => {
      const input: CreateContentParticipantInput = {
        contentItemId: 'item-123',
        name: 'John Doe',
        userId: 'user-123',
        email: 'john@example.com',
        externalId: 'slack-user-123',
      };

      expect(input.userId).toBe('user-123');
      expect(input.email).toBe('john@example.com');
      expect(input.externalId).toBe('slack-user-123');
    });
  });

  describe('ContentRepositoryService interface', () => {
    it('should define all required methods', () => {
      // This test verifies the interface structure at compile time
      const mockService: ContentRepositoryService = {
        // Sources
        createSource: () => {
          throw new Error('Mock');
        },
        getSource: () => {
          throw new Error('Mock');
        },
        getSourceOption: () => {
          throw new Error('Mock');
        },
        getSources: () => {
          throw new Error('Mock');
        },
        getSourcesWithStats: () => {
          throw new Error('Mock');
        },
        updateSource: () => {
          throw new Error('Mock');
        },
        deleteSource: () => {
          throw new Error('Mock');
        },
        // Items
        createItem: () => {
          throw new Error('Mock');
        },
        upsertItem: () => {
          throw new Error('Mock');
        },
        getItem: () => {
          throw new Error('Mock');
        },
        getItemOption: () => {
          throw new Error('Mock');
        },
        getItemByExternalId: () => {
          throw new Error('Mock');
        },
        getItems: () => {
          throw new Error('Mock');
        },
        getItemWithRelations: () => {
          throw new Error('Mock');
        },
        updateItem: () => {
          throw new Error('Mock');
        },
        deleteItem: () => {
          throw new Error('Mock');
        },
        deleteItemsBySource: () => {
          throw new Error('Mock');
        },
        // Relationships
        createRelationship: () => {
          throw new Error('Mock');
        },
        getRelationships: () => {
          throw new Error('Mock');
        },
        deleteRelationship: () => {
          throw new Error('Mock');
        },
        // Participants
        createParticipant: () => {
          throw new Error('Mock');
        },
        createParticipantsBatch: () => {
          throw new Error('Mock');
        },
        getParticipants: () => {
          throw new Error('Mock');
        },
        deleteParticipant: () => {
          throw new Error('Mock');
        },
        // Chunks
        createChunks: () => {
          throw new Error('Mock');
        },
        getChunks: () => {
          throw new Error('Mock');
        },
        deleteChunks: () => {
          throw new Error('Mock');
        },
        // Batch operations
        updateProcessingStatus: () => {
          throw new Error('Mock');
        },
      };

      // Verify source methods
      expect(mockService.createSource).toBeDefined();
      expect(mockService.getSource).toBeDefined();
      expect(mockService.getSourceOption).toBeDefined();
      expect(mockService.getSources).toBeDefined();
      expect(mockService.getSourcesWithStats).toBeDefined();
      expect(mockService.updateSource).toBeDefined();
      expect(mockService.deleteSource).toBeDefined();

      // Verify item methods
      expect(mockService.createItem).toBeDefined();
      expect(mockService.upsertItem).toBeDefined();
      expect(mockService.getItem).toBeDefined();
      expect(mockService.getItemOption).toBeDefined();
      expect(mockService.getItemByExternalId).toBeDefined();
      expect(mockService.getItems).toBeDefined();
      expect(mockService.getItemWithRelations).toBeDefined();
      expect(mockService.updateItem).toBeDefined();
      expect(mockService.deleteItem).toBeDefined();
      expect(mockService.deleteItemsBySource).toBeDefined();

      // Verify relationship methods
      expect(mockService.createRelationship).toBeDefined();
      expect(mockService.getRelationships).toBeDefined();
      expect(mockService.deleteRelationship).toBeDefined();

      // Verify participant methods
      expect(mockService.createParticipant).toBeDefined();
      expect(mockService.createParticipantsBatch).toBeDefined();
      expect(mockService.getParticipants).toBeDefined();
      expect(mockService.deleteParticipant).toBeDefined();

      // Verify chunk methods
      expect(mockService.createChunks).toBeDefined();
      expect(mockService.getChunks).toBeDefined();
      expect(mockService.deleteChunks).toBeDefined();
    });
  });
});
