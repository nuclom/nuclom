/**
 * E2E Test User Seed Script
 *
 * Creates a test user and organization for E2E tests.
 * This script is idempotent - it can be run multiple times safely.
 *
 * Usage:
 *   DATABASE_URL=... E2E_TEST_USER_EMAIL=... E2E_TEST_USER_PASSWORD=... npx tsx scripts/seed-e2e-user.ts
 *
 * Required environment variables:
 *   - DATABASE_URL: PostgreSQL connection string
 *   - E2E_TEST_USER_EMAIL: Email for the test user
 *   - E2E_TEST_USER_PASSWORD: Password for the test user
 *
 * Optional:
 *   - E2E_TEST_ORG: Organization slug (default: 'e2e-tests')
 */

import process from 'node:process';
import { hashPassword } from 'better-auth/crypto';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/lib/db/schema/auth';

dotenv.config({ path: ['.env.local', '.env'] });

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Error: ${name} environment variable is required`);
    process.exit(1);
  }
  return value;
}

const DATABASE_URL = getRequiredEnv('DATABASE_URL');
const E2E_TEST_USER_EMAIL = getRequiredEnv('E2E_TEST_USER_EMAIL');
const E2E_TEST_USER_PASSWORD = getRequiredEnv('E2E_TEST_USER_PASSWORD');
const E2E_TEST_ORG = process.env.E2E_TEST_ORG || 'e2e-tests';

function generateId(): string {
  return crypto.randomUUID();
}

async function main() {
  console.log('\n🌱 E2E Test User Seed Script\n');
  console.log('='.repeat(50));
  console.log(`Email: ${E2E_TEST_USER_EMAIL}`);
  console.log(`Organization: ${E2E_TEST_ORG}`);
  console.log('='.repeat(50));

  const client = postgres(DATABASE_URL, { prepare: false });
  const db = drizzle(client, { schema });

  try {
    // Check if user already exists
    const existingUser = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, E2E_TEST_USER_EMAIL))
      .limit(1);

    let userId: string;

    if (existingUser.length > 0) {
      userId = existingUser[0].id;
      console.log(`\n✅ User already exists: ${userId}`);

      // Update the password in case it changed
      const hashedPassword = await hashPassword(E2E_TEST_USER_PASSWORD);
      await db.update(schema.accounts).set({ password: hashedPassword }).where(eq(schema.accounts.userId, userId));
      console.log('✅ Password updated');
    } else {
      // Create user
      userId = generateId();
      const hashedPassword = await hashPassword(E2E_TEST_USER_PASSWORD);

      await db.insert(schema.users).values({
        id: userId,
        name: 'E2E Test User',
        email: E2E_TEST_USER_EMAIL,
        emailVerified: true, // Skip email verification for test user
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`\n✅ Created user: ${userId}`);

      // Create credential account
      await db.insert(schema.accounts).values({
        id: generateId(),
        accountId: userId,
        providerId: 'credential',
        userId: userId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('✅ Created credential account');
    }

    // Check if organization exists
    const existingOrg = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.slug, E2E_TEST_ORG))
      .limit(1);

    let orgId: string;

    if (existingOrg.length > 0) {
      orgId = existingOrg[0].id;
      console.log(`✅ Organization already exists: ${orgId}`);
    } else {
      // Create organization
      orgId = generateId();
      await db.insert(schema.organizations).values({
        id: orgId,
        name: E2E_TEST_ORG.charAt(0).toUpperCase() + E2E_TEST_ORG.slice(1),
        slug: E2E_TEST_ORG,
        createdAt: new Date(),
      });
      console.log(`✅ Created organization: ${orgId}`);
    }

    // Check if membership exists
    const existingMembership = await db.select().from(schema.members).where(eq(schema.members.userId, userId)).limit(1);

    if (existingMembership.length > 0) {
      console.log('✅ Membership already exists');
    } else {
      // Add user to organization as owner
      await db.insert(schema.members).values({
        id: generateId(),
        organizationId: orgId,
        userId: userId,
        role: 'owner',
        createdAt: new Date(),
      });
      console.log('✅ Added user to organization as owner');
    }

    console.log(`\n${'='.repeat(50)}`);
    console.log('🎉 E2E test user setup complete!');
    console.log('='.repeat(50));
    console.log(`\nTest credentials:`);
    console.log(`  Email: ${E2E_TEST_USER_EMAIL}`);
    console.log(`  Password: ${E2E_TEST_USER_PASSWORD}`);
    console.log(`  Organization: /${E2E_TEST_ORG}\n`);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
