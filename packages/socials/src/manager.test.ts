import { describe, expect, it } from 'bun:test';
import { Effect } from 'effect';
import { createSocialsManager, getAvailableProviders, isValidProvider } from './manager.ts';

describe('SocialsManager', () => {
  describe('getAvailableProviders', () => {
    it('should return twitter as available provider', () => {
      const providers = getAvailableProviders();
      expect(providers).toContain('twitter');
    });
  });

  describe('isValidProvider', () => {
    it('should return true for twitter', () => {
      expect(isValidProvider('twitter')).toBe(true);
    });

    it('should return false for unknown provider', () => {
      expect(isValidProvider('unknown')).toBe(false);
    });
  });

  describe('createSocialsManager', () => {
    it('should create a manager instance', () => {
      const manager = createSocialsManager();
      expect(manager).toBeDefined();
    });
  });

  describe('hasCredentials', () => {
    it('should return false when no credentials are stored', async () => {
      const manager = createSocialsManager();
      const result = await Effect.runPromise(manager.hasCredentials('twitter'));
      expect(result).toBe(false);
    });
  });
});
