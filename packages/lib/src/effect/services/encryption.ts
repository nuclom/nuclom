/**
 * Encryption Service
 *
 * Provides AES-256-GCM encryption for sensitive data like OAuth credentials.
 * Uses Node.js native crypto module for zero-dependency encryption.
 *
 * Security features:
 * - AES-256-GCM authenticated encryption (prevents tampering)
 * - Unique IV (Initialization Vector) for each encryption
 * - Key derived from environment variable
 *
 * Encrypted format: iv:authTag:ciphertext (all base64 encoded)
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Context, Effect, Layer } from 'effect';
import { EncryptionError, EncryptionKeyNotConfiguredError } from '../errors';

// =============================================================================
// Constants
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits - recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const KEY_LENGTH = 32; // 256 bits
const SEPARATOR = ':';

// =============================================================================
// Service Interface
// =============================================================================

export interface EncryptionServiceImpl {
  /**
   * Encrypt a string value using AES-256-GCM.
   * Returns the encrypted value in format: iv:authTag:ciphertext (base64)
   */
  encrypt(plaintext: string): Effect.Effect<string, EncryptionError>;

  /**
   * Decrypt a value that was encrypted with encrypt().
   * Expects format: iv:authTag:ciphertext (base64)
   */
  decrypt(encrypted: string): Effect.Effect<string, EncryptionError>;

  /**
   * Encrypt a JSON-serializable object.
   * Returns the encrypted value in format: iv:authTag:ciphertext (base64)
   */
  encryptJson<T>(data: T): Effect.Effect<string, EncryptionError>;

  /**
   * Decrypt and parse a JSON object.
   * Returns the original object type.
   */
  decryptJson<T>(encrypted: string): Effect.Effect<T, EncryptionError>;

  /**
   * Check if a value appears to be encrypted (has correct format).
   */
  isEncrypted(value: string): boolean;
}

// =============================================================================
// Service Tag
// =============================================================================

export class EncryptionService extends Context.Tag('EncryptionService')<EncryptionService, EncryptionServiceImpl>() {}

// =============================================================================
// Service Implementation
// =============================================================================

const makeEncryptionService = (encryptionKey: Buffer): EncryptionServiceImpl => ({
  encrypt: (plaintext) =>
    Effect.try({
      try: () => {
        const iv = randomBytes(IV_LENGTH);
        const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, {
          authTagLength: AUTH_TAG_LENGTH,
        });

        const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

        const authTag = cipher.getAuthTag();

        // Format: iv:authTag:ciphertext (all base64)
        return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(SEPARATOR);
      },
      catch: (error) =>
        new EncryptionError({
          message: 'Failed to encrypt data',
          operation: 'encrypt',
          cause: error,
        }),
    }),

  decrypt: (encrypted) =>
    Effect.try({
      try: () => {
        const parts = encrypted.split(SEPARATOR);
        if (parts.length !== 3) {
          throw new Error('Invalid encrypted format: expected iv:authTag:ciphertext');
        }

        const [ivBase64, authTagBase64, ciphertextBase64] = parts;
        const iv = Buffer.from(ivBase64, 'base64');
        const authTag = Buffer.from(authTagBase64, 'base64');
        const ciphertext = Buffer.from(ciphertextBase64, 'base64');

        // Validate IV length
        if (iv.length !== IV_LENGTH) {
          throw new Error(`Invalid IV length: expected ${IV_LENGTH}, got ${iv.length}`);
        }

        // Validate auth tag length
        if (authTag.length !== AUTH_TAG_LENGTH) {
          throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
        }

        const decipher = createDecipheriv(ALGORITHM, encryptionKey, iv, {
          authTagLength: AUTH_TAG_LENGTH,
        });
        decipher.setAuthTag(authTag);

        const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        return decrypted.toString('utf8');
      },
      catch: (error) =>
        new EncryptionError({
          message: 'Failed to decrypt data',
          operation: 'decrypt',
          cause: error,
        }),
    }),

  encryptJson: <T>(data: T) =>
    Effect.gen(function* () {
      const jsonString = JSON.stringify(data);
      const service = makeEncryptionService(encryptionKey);
      return yield* service.encrypt(jsonString);
    }),

  decryptJson: <T>(encrypted: string) =>
    Effect.gen(function* () {
      const service = makeEncryptionService(encryptionKey);
      const jsonString = yield* service.decrypt(encrypted);
      try {
        return JSON.parse(jsonString) as T;
      } catch (error) {
        return yield* Effect.fail(
          new EncryptionError({
            message: 'Failed to parse decrypted JSON',
            operation: 'decrypt',
            cause: error,
          }),
        );
      }
    }),

  isEncrypted: (value) => {
    if (typeof value !== 'string') return false;
    const parts = value.split(SEPARATOR);
    if (parts.length !== 3) return false;

    try {
      const iv = Buffer.from(parts[0], 'base64');
      const authTag = Buffer.from(parts[1], 'base64');
      return iv.length === IV_LENGTH && authTag.length === AUTH_TAG_LENGTH;
    } catch {
      return false;
    }
  },
});

// =============================================================================
// Layer
// =============================================================================

/**
 * Live layer that reads the encryption key from environment variable.
 * Requires CREDENTIALS_ENCRYPTION_KEY to be set.
 */
export const EncryptionServiceLive = Layer.effect(
  EncryptionService,
  Effect.gen(function* () {
    const keyHex = process.env.CREDENTIALS_ENCRYPTION_KEY;

    if (!keyHex) {
      return yield* Effect.fail(EncryptionKeyNotConfiguredError.default);
    }

    // Validate key format (should be 64 hex characters = 32 bytes)
    if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
      return yield* Effect.fail(
        new EncryptionKeyNotConfiguredError({
          message: 'Invalid CREDENTIALS_ENCRYPTION_KEY: must be 64 hexadecimal characters (256-bit key)',
        }),
      );
    }

    const encryptionKey = Buffer.from(keyHex, 'hex');

    if (encryptionKey.length !== KEY_LENGTH) {
      return yield* Effect.fail(
        new EncryptionKeyNotConfiguredError({
          message: `Invalid encryption key length: expected ${KEY_LENGTH} bytes, got ${encryptionKey.length}`,
        }),
      );
    }

    return makeEncryptionService(encryptionKey);
  }),
);

/**
 * Test layer with a fixed key for testing purposes only.
 * DO NOT USE IN PRODUCTION.
 */
export const EncryptionServiceTest = Layer.succeed(
  EncryptionService,
  makeEncryptionService(Buffer.from('0'.repeat(64), 'hex')),
);

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Encrypt a string value.
 */
export const encrypt = (plaintext: string) =>
  Effect.gen(function* () {
    const service = yield* EncryptionService;
    return yield* service.encrypt(plaintext);
  });

/**
 * Decrypt a string value.
 */
export const decrypt = (encrypted: string) =>
  Effect.gen(function* () {
    const service = yield* EncryptionService;
    return yield* service.decrypt(encrypted);
  });

/**
 * Encrypt a JSON-serializable object.
 */
export const encryptJson = <T>(data: T) =>
  Effect.gen(function* () {
    const service = yield* EncryptionService;
    return yield* service.encryptJson(data);
  });

/**
 * Decrypt and parse a JSON object.
 */
export const decryptJson = <T>(encrypted: string) =>
  Effect.gen(function* () {
    const service = yield* EncryptionService;
    return yield* service.decryptJson<T>(encrypted);
  });

/**
 * Check if a value appears to be encrypted.
 */
export const isEncrypted = (value: string) =>
  Effect.gen(function* () {
    const service = yield* EncryptionService;
    return service.isEncrypted(value);
  });
