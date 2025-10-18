/**
 * Database URL Configuration
 *
 * SECURITY BEST PRACTICE:
 * Constructs DATABASE_URL from individual environment variables instead of
 * storing credentials in a single string. This provides:
 * - Better credential isolation
 * - Easier password rotation
 * - Reduced risk if DATABASE_URL is accidentally logged
 */

/**
 * Get database URL from environment variables
 *
 * Priority:
 * 1. Use DATABASE_URL if explicitly set (backward compatibility)
 * 2. Construct from individual components (POSTGRES_USER, POSTGRES_PASSWORD, etc.)
 *
 * @returns PostgreSQL connection string
 * @throws Error if required variables are missing
 */
export function getDatabaseUrl(): string {
  // Option 1: Use explicit DATABASE_URL if provided (backward compatibility)
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  // Option 2: Construct from components (RECOMMENDED for security)
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const database = process.env.POSTGRES_DB || 'notez';
  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;

  // Validate required credentials
  if (!user) {
    throw new Error(
      'Database configuration error: POSTGRES_USER is required. ' +
      'Set either POSTGRES_USER or DATABASE_URL environment variable.'
    );
  }

  if (!password) {
    throw new Error(
      'Database configuration error: POSTGRES_PASSWORD is required. ' +
      'Set either POSTGRES_PASSWORD or DATABASE_URL environment variable.'
    );
  }

  // Construct URL (URL-encode password to handle special characters)
  const encodedPassword = encodeURIComponent(password);
  const url = `postgresql://${user}:${encodedPassword}@${host}:${port}/${database}?schema=public`;

  return url;
}

/**
 * Get database URL with password redacted (safe for logging)
 *
 * @returns Connection string with password replaced by asterisks
 */
export function getDatabaseUrlSafe(): string {
  const url = getDatabaseUrl();
  // Replace password with asterisks (handle both URL-encoded and plain passwords)
  return url.replace(/(:\/\/[^:]+:)([^@]+)(@)/, '$1********$3');
}
