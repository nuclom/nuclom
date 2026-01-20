import { Effect, Exit } from 'effect';
import { describe, expect, it } from 'vitest';
import { decrypt, decryptJson, EncryptionService, EncryptionServiceTest, encrypt, encryptJson } from './encryption';

describe('EncryptionService', () => {
  const runWithTestLayer = <A, E>(effect: Effect.Effect<A, E, EncryptionService>) =>
    Effect.runPromise(Effect.provide(effect, EncryptionServiceTest));

  const runExitWithTestLayer = <A, E>(effect: Effect.Effect<A, E, EncryptionService>) =>
    Effect.runPromiseExit(Effect.provide(effect, EncryptionServiceTest));

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string', async () => {
      const plaintext = 'Hello, World!';

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encrypt(plaintext);
          const decrypted = yield* decrypt(encrypted);
          return { encrypted, decrypted };
        }),
      );

      expect(result.encrypted).not.toBe(plaintext);
      expect(result.decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (unique IV)', async () => {
      const plaintext = 'Same text';

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted1 = yield* encrypt(plaintext);
          const encrypted2 = yield* encrypt(plaintext);
          return { encrypted1, encrypted2 };
        }),
      );

      expect(result.encrypted1).not.toBe(result.encrypted2);
    });

    it('should handle empty string', async () => {
      const plaintext = '';

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encrypt(plaintext);
          const decrypted = yield* decrypt(encrypted);
          return decrypted;
        }),
      );

      expect(result).toBe('');
    });

    it('should handle unicode characters', async () => {
      const plaintext = '你好世界 🌍 مرحبا';

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encrypt(plaintext);
          const decrypted = yield* decrypt(encrypted);
          return decrypted;
        }),
      );

      expect(result).toBe(plaintext);
    });

    it('should fail to decrypt invalid data', async () => {
      const exit = await runExitWithTestLayer(decrypt('invalid-data'));

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause;
        expect(error._tag).toBe('Fail');
      }
    });

    it('should fail to decrypt tampered data', async () => {
      const plaintext = 'Secret data';

      const exit = await runExitWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encrypt(plaintext);
          // Tamper with the ciphertext
          const parts = encrypted.split(':');
          parts[2] = Buffer.from('tampered').toString('base64');
          const tampered = parts.join(':');
          return yield* decrypt(tampered);
        }),
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });
  });

  describe('encryptJson/decryptJson', () => {
    it('should encrypt and decrypt a JSON object', async () => {
      const data = {
        accessToken: 'xoxb-123456',
        refreshToken: 'refresh-789',
        expiresAt: '2025-01-01T00:00:00Z',
      };

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encryptJson(data);
          const decrypted = yield* decryptJson<typeof data>(encrypted);
          return { encrypted, decrypted };
        }),
      );

      expect(result.encrypted).not.toContain('xoxb-123456');
      expect(result.decrypted).toEqual(data);
    });

    it('should handle nested objects', async () => {
      const data = {
        credentials: {
          accessToken: 'token123',
          metadata: {
            scope: ['read', 'write'],
            teamId: 'T123',
          },
        },
      };

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encryptJson(data);
          const decrypted = yield* decryptJson<typeof data>(encrypted);
          return decrypted;
        }),
      );

      expect(result).toEqual(data);
    });

    it('should handle arrays', async () => {
      const data = ['token1', 'token2', 'token3'];

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encryptJson(data);
          const decrypted = yield* decryptJson<typeof data>(encrypted);
          return decrypted;
        }),
      );

      expect(result).toEqual(data);
    });

    it('should handle null values', async () => {
      const data = { accessToken: 'token', refreshToken: null };

      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const encrypted = yield* encryptJson(data);
          const decrypted = yield* decryptJson<typeof data>(encrypted);
          return decrypted;
        }),
      );

      expect(result).toEqual(data);
    });
  });

  describe('isEncrypted', () => {
    it('should return true for encrypted values', async () => {
      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const service = yield* EncryptionService;
          const encrypted = yield* encrypt('test');
          return service.isEncrypted(encrypted);
        }),
      );

      expect(result).toBe(true);
    });

    it('should return false for plain text', async () => {
      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const service = yield* EncryptionService;
          return service.isEncrypted('plain text');
        }),
      );

      expect(result).toBe(false);
    });

    it('should return false for JSON', async () => {
      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const service = yield* EncryptionService;
          return service.isEncrypted('{"accessToken": "token123"}');
        }),
      );

      expect(result).toBe(false);
    });

    it('should return false for malformed encrypted format', async () => {
      const result = await runWithTestLayer(
        Effect.gen(function* () {
          const service = yield* EncryptionService;
          return service.isEncrypted('abc:def'); // Missing third part
        }),
      );

      expect(result).toBe(false);
    });
  });

  describe('encrypted format', () => {
    it('should produce format iv:authTag:ciphertext', async () => {
      const encrypted = await runWithTestLayer(encrypt('test'));

      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);

      // IV should be 12 bytes = 16 base64 chars
      const iv = Buffer.from(parts[0], 'base64');
      expect(iv.length).toBe(12);

      // Auth tag should be 16 bytes
      const authTag = Buffer.from(parts[1], 'base64');
      expect(authTag.length).toBe(16);

      // Ciphertext should be valid base64
      expect(() => Buffer.from(parts[2], 'base64')).not.toThrow();
    });
  });
});
