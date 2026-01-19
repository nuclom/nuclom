/**
 * Credential Encryption Migration Script
 *
 * Encrypts existing plaintext OAuth credentials in the content_sources table.
 * This script is idempotent - it only encrypts credentials that are not already encrypted.
 *
 * Usage:
 *   DATABASE_URL=... CREDENTIALS_ENCRYPTION_KEY=... npx tsx scripts/migrate-encrypt-credentials.ts
 *
 * Required environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - CREDENTIALS_ENCRYPTION_KEY: 64-character hex string (256-bit key)
 *
 * Options:
 *   --dry-run: Preview changes without applying them
 *   --verbose: Show detailed output for each source
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import { eq, isNotNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../packages/lib/src/db/schema/content';

dotenv.config({ path: ['.env.local', '.env'] });

// =============================================================================
// Configuration
// =============================================================================

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SEPARATOR = ':';

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

const DATABASE_URL = getRequiredEnv('DATABASE_URL');
const ENCRYPTION_KEY_HEX = getRequiredEnv('CREDENTIALS_ENCRYPTION_KEY');

// Validate encryption key
if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY_HEX)) {
  console.error('Error: CREDENTIALS_ENCRYPTION_KEY must be 64 hexadecimal characters (256-bit key)');
  process.exit(1);
}

const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
if (ENCRYPTION_KEY.length !== KEY_LENGTH) {
  console.error(`Error: Invalid encryption key length: expected ${KEY_LENGTH} bytes`);
  process.exit(1);
}

// Parse command line options
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// =============================================================================
// Encryption Functions
// =============================================================================

type EncryptedCredentials = {
  readonly _encrypted: string;
};

function isEncryptedCredentials(credentials: unknown): credentials is EncryptedCredentials {
  return (
    credentials !== null && credentials !== undefined && typeof credentials === 'object' && '_encrypted' in credentials
  );
}

function encryptCredentials(credentials: schema.ContentSourceCredentials): string {
  const plaintext = JSON.stringify(credentials);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(SEPARATOR);
}

// =============================================================================
// Migration
// =============================================================================

async function main() {
  console.log('\n🔐 Credential Encryption Migration\n');
  console.log('='.repeat(50));
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made');
  }
  console.log('='.repeat(50));

  const client = postgres(DATABASE_URL, { prepare: false });
  const db = drizzle(client, { schema: { contentSources: schema.contentSources } });

  try {
    // Get all content sources with credentials
    const sources = await db
      .select({
        id: schema.contentSources.id,
        name: schema.contentSources.name,
        type: schema.contentSources.type,
        credentials: schema.contentSources.credentials,
      })
      .from(schema.contentSources)
      .where(isNotNull(schema.contentSources.credentials));

    console.log(`\nFound ${sources.length} content sources with credentials\n`);

    let encryptedCount = 0;
    let alreadyEncryptedCount = 0;
    let errorCount = 0;

    for (const source of sources) {
      const credentials = source.credentials;

      // Skip if already encrypted
      if (isEncryptedCredentials(credentials)) {
        alreadyEncryptedCount++;
        if (VERBOSE) {
          console.log(`⏭️  ${source.name} (${source.type}): Already encrypted`);
        }
        continue;
      }

      // Skip if credentials are null/empty
      if (!credentials || Object.keys(credentials).length === 0) {
        if (VERBOSE) {
          console.log(`⏭️  ${source.name} (${source.type}): No credentials to encrypt`);
        }
        continue;
      }

      try {
        const encrypted = encryptCredentials(credentials as schema.ContentSourceCredentials);
        const encryptedCredentials: EncryptedCredentials = { _encrypted: encrypted };

        if (VERBOSE) {
          console.log(`🔐 ${source.name} (${source.type}): Encrypting credentials...`);
          // Show masked preview of what we're encrypting
          const credKeys = Object.keys(credentials);
          console.log(`   Fields: ${credKeys.join(', ')}`);
        }

        if (!DRY_RUN) {
          await db
            .update(schema.contentSources)
            .set({ credentials: encryptedCredentials as unknown as schema.ContentSourceCredentials })
            .where(eq(schema.contentSources.id, source.id));
        }

        encryptedCount++;
        console.log(`✅ ${source.name} (${source.type}): ${DRY_RUN ? 'Would encrypt' : 'Encrypted'}`);
      } catch (error) {
        errorCount++;
        console.error(`❌ ${source.name} (${source.type}): Failed to encrypt`, error);
      }
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('📊 Migration Summary');
    console.log('='.repeat(50));
    console.log(`Total sources with credentials: ${sources.length}`);
    console.log(`Already encrypted: ${alreadyEncryptedCount}`);
    console.log(`${DRY_RUN ? 'Would encrypt' : 'Encrypted'}: ${encryptedCount}`);
    if (errorCount > 0) {
      console.log(`Errors: ${errorCount}`);
    }

    if (DRY_RUN) {
      console.log('\n⚠️  This was a dry run. Run without --dry-run to apply changes.\n');
    } else {
      console.log('\n🎉 Migration complete!\n');
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
