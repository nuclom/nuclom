# Credential Encryption at Rest

This document describes the encryption system for OAuth credentials stored in the `content_sources` table.

## Overview

OAuth credentials (access tokens, refresh tokens, API keys) are encrypted at rest using AES-256-GCM authenticated encryption. This protects credentials if the database is compromised.

## Technical Details

### Algorithm

- **Cipher**: AES-256-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV (Initialization Vector)**: 96 bits (12 bytes), randomly generated per encryption
- **Authentication Tag**: 128 bits (16 bytes)

AES-256-GCM provides:
- **Confidentiality**: Data cannot be read without the key
- **Integrity**: Tampering is detected via the authentication tag
- **Quantum resistance**: 256-bit keys provide security against quantum attacks

### Storage Format

Encrypted credentials are stored as JSON in the `credentials` column:

```json
{
  "_encrypted": "iv:authTag:ciphertext"
}
```

Where `iv`, `authTag`, and `ciphertext` are base64-encoded.

### Backward Compatibility

The system automatically handles:
- **Unencrypted credentials**: Read as-is (legacy support during migration)
- **Encrypted credentials**: Detected by `_encrypted` field, decrypted on read

## Environment Variable

```bash
# 256-bit key as 64 hexadecimal characters
CREDENTIALS_ENCRYPTION_KEY=your-64-character-hex-key-here
```

Generate a new key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Key Rotation Strategy

### When to Rotate

1. **Scheduled rotation**: Rotate keys annually or per security policy
2. **After a suspected compromise**: Immediately rotate if key may be exposed
3. **Personnel changes**: Rotate when team members with access leave
4. **Key wear-out**: Theoretically after encrypting ~4GB of data (millions of credentials)

### Rotation Process

1. **Generate a new key**:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **Deploy new encryption service with both keys**:
   - Update the application to support multiple keys
   - Primary key for new encryptions
   - Legacy key for decrypting existing data

3. **Re-encrypt all credentials**:
   ```bash
   # First, do a dry run
   DATABASE_URL=... CREDENTIALS_ENCRYPTION_KEY=<new-key> \
     npx tsx scripts/migrate-encrypt-credentials.ts --dry-run

   # Then apply (this will re-encrypt with the new key)
   DATABASE_URL=... CREDENTIALS_ENCRYPTION_KEY=<new-key> \
     npx tsx scripts/migrate-encrypt-credentials.ts
   ```

4. **Remove legacy key support** after verifying all credentials are re-encrypted

### Multi-Key Support (Future Enhancement)

For zero-downtime rotation, implement key versioning:

```json
{
  "_encrypted": "v2:iv:authTag:ciphertext"
}
```

Where `v2` indicates the key version. The service would:
1. Try decryption with the current key
2. Fall back to previous keys if needed
3. Re-encrypt with the current key on next update

## Migration

### Initial Migration

Run the migration script to encrypt existing plaintext credentials:

```bash
# Preview changes
DATABASE_URL=... CREDENTIALS_ENCRYPTION_KEY=... \
  npx tsx scripts/migrate-encrypt-credentials.ts --dry-run

# Apply changes
DATABASE_URL=... CREDENTIALS_ENCRYPTION_KEY=... \
  npx tsx scripts/migrate-encrypt-credentials.ts
```

Options:
- `--dry-run`: Preview without making changes
- `--verbose`: Show detailed output for each source

### Verifying Encryption

Query the database to verify credentials are encrypted:

```sql
SELECT id, name, type,
       credentials->>'_encrypted' IS NOT NULL as is_encrypted
FROM content_sources
WHERE credentials IS NOT NULL;
```

## Security Considerations

1. **Key Storage**: Store `CREDENTIALS_ENCRYPTION_KEY` securely:
   - Use your deployment platform's secrets management (Vercel, AWS Secrets Manager, etc.)
   - Never commit to version control
   - Limit access to production keys

2. **Key Access**: Only the application server needs the key
   - Database administrators cannot decrypt without the key
   - Backups contain encrypted data

3. **Logging**: Never log decrypted credentials or the encryption key

4. **Error Handling**: Encryption failures prevent credential storage
   - Decryption failures are logged and reported
   - Invalid credentials do not expose plaintext

## Architecture

```
┌─────────────────┐     ┌────────────────┐     ┌──────────────────┐
│   API Route     │────▶│ ContentRepo    │────▶│  EncryptionSvc   │
│                 │     │                │     │                  │
│ createSource()  │     │ encrypt creds  │     │ AES-256-GCM      │
│ updateSource()  │     │ before insert  │     │                  │
│ getSource()     │     │ decrypt creds  │     │ Uses env key     │
│                 │     │ after select   │     │                  │
└─────────────────┘     └────────────────┘     └──────────────────┘
                                                        │
                                                        ▼
                                              ┌──────────────────┐
                                              │ CREDENTIALS_     │
                                              │ ENCRYPTION_KEY   │
                                              │ (env variable)   │
                                              └──────────────────┘
```

## Files

- `packages/lib/src/effect/services/encryption.ts` - Encryption service
- `packages/lib/src/effect/services/encryption.test.ts` - Tests
- `packages/lib/src/effect/services/content/content-repository.ts` - Repository with encryption
- `scripts/migrate-encrypt-credentials.ts` - Migration script

## Related

- [Content Source Abstraction](./content-source-abstraction.md)
- Issue #318 - Encrypt OAuth credentials at rest
