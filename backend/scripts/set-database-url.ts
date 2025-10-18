/**
 * Set DATABASE_URL environment variable before running Prisma commands
 *
 * This script constructs DATABASE_URL from individual components if not already set.
 * Used as a pre-script for Prisma commands to ensure secure credential handling.
 *
 * Usage:
 *   tsx scripts/set-database-url.ts && prisma migrate deploy
 */

import { getDatabaseUrl, getDatabaseUrlSafe } from '../src/lib/database-url.js';

try {
  // Construct DATABASE_URL from components
  const databaseUrl = getDatabaseUrl();

  // Set environment variable for subsequent commands
  process.env.DATABASE_URL = databaseUrl;

  // Log safe version (with redacted password)
  console.log(`✓ Database URL configured: ${getDatabaseUrlSafe()}`);

  process.exit(0);
} catch (error) {
  if (error instanceof Error) {
    console.error(`✗ ${error.message}`);
  } else {
    console.error('✗ Failed to configure database URL');
  }
  process.exit(1);
}
