import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // For AES, this is always 16
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const TAG_POSITION = SALT_LENGTH + IV_LENGTH;
const ENCRYPTED_POSITION = TAG_POSITION + TAG_LENGTH;

/**
 * Get encryption key from environment variable
 * Falls back to a default key for development (NOT FOR PRODUCTION!)
 */
function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable must be set in production');
    }
    // Development fallback - NEVER use in production!
    console.warn('⚠️  Using default encryption key for development. Set ENCRYPTION_KEY in production!');
    return 'dev-encryption-key-32-chars!!!'; // Must be exactly 32 characters for AES-256
  }

  if (key.length < 32) {
    throw new Error(`ENCRYPTION_KEY must be at least 32 characters (current: ${key.length})`);
  }

  // If key is longer than 32 characters, truncate it to 32
  if (key.length > 32) {
    console.warn(`⚠️  ENCRYPTION_KEY is ${key.length} characters, truncating to 32 characters`);
    return key.substring(0, 32);
  }

  return key;
}

/**
 * Derive a key from the encryption key using PBKDF2
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
}

/**
 * Encrypt a string value
 * @param text Plain text to encrypt
 * @returns Encrypted string (base64 encoded)
 */
export function encrypt(text: string): string {
  const encryptionKey = getEncryptionKey();

  // Generate random salt and IV
  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);

  // Derive key from password and salt
  const key = deriveKey(encryptionKey, salt);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the text
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);

  // Get authentication tag
  const tag = cipher.getAuthTag();

  // Combine salt + iv + tag + encrypted data
  const result = Buffer.concat([salt, iv, tag, encrypted]);

  // Return as base64 string
  return result.toString('base64');
}

/**
 * Decrypt an encrypted string
 * @param encryptedData Encrypted string (base64 encoded)
 * @returns Decrypted plain text
 */
export function decrypt(encryptedData: string): string {
  const encryptionKey = getEncryptionKey();

  // Convert from base64
  const buffer = Buffer.from(encryptedData, 'base64');

  // Extract salt, iv, tag, and encrypted data
  const salt = buffer.subarray(0, SALT_LENGTH);
  const iv = buffer.subarray(SALT_LENGTH, TAG_POSITION);
  const tag = buffer.subarray(TAG_POSITION, ENCRYPTED_POSITION);
  const encrypted = buffer.subarray(ENCRYPTED_POSITION);

  // Derive key from password and salt
  const key = deriveKey(encryptionKey, salt);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  // Decrypt the data
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Test encryption/decryption functionality
 * @returns True if working correctly
 */
export function testEncryption(): boolean {
  const testString = 'Hello, World! This is a test.';

  try {
    const encrypted = encrypt(testString);
    const decrypted = decrypt(encrypted);
    return decrypted === testString;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}
