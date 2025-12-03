import sharp from 'sharp';

// Allowed MIME types for image uploads
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

// Maximum filename length to store
const MAX_FILENAME_LENGTH = 255;

/**
 * Validate image content by actually parsing it with Sharp.
 * This prevents content-type spoofing and validates the file is a real image.
 *
 * @param buffer - The image buffer to validate
 * @returns Object with valid flag and detected format
 */
export async function validateImageContent(
  buffer: Buffer
): Promise<{ valid: boolean; detectedFormat?: string }> {
  try {
    const metadata = await sharp(buffer).metadata();

    if (!metadata.format) {
      return { valid: false };
    }

    // Map sharp format names to MIME types
    const formatToMime: Record<string, string> = {
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };

    const detectedMime = formatToMime[metadata.format];

    // Verify the detected format matches an allowed type
    if (!detectedMime || !ALLOWED_IMAGE_MIME_TYPES.includes(detectedMime)) {
      return { valid: false, detectedFormat: metadata.format };
    }

    return { valid: true, detectedFormat: metadata.format };
  } catch {
    // Sharp couldn't parse the file - not a valid image
    return { valid: false };
  }
}

/**
 * Sanitize a filename for safe storage and display.
 * - Removes control characters
 * - Removes path traversal attempts
 * - Limits length
 * - Replaces unsafe characters
 *
 * @param filename - The original filename from the client
 * @param fallback - Fallback name if sanitization results in empty string
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string | undefined, fallback: string): string {
  if (!filename) {
    return fallback;
  }

  // Normalize Unicode to NFC form for consistent storage
  let sanitized = filename.normalize('NFC');

  // Remove control characters (ASCII 0-31)
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');

  // Remove path traversal attempts and path separators
  sanitized = sanitized.replace(/[/\\]/g, '_');
  sanitized = sanitized.replace(/\.\./g, '_');

  // Remove other potentially dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

  // Trim whitespace and dots from start/end
  sanitized = sanitized.replace(/^[\s.]+|[\s.]+$/g, '');

  // Collapse multiple underscores
  sanitized = sanitized.replace(/_+/g, '_');

  // Limit length
  if (sanitized.length > MAX_FILENAME_LENGTH) {
    // Keep the extension if present
    const lastDot = sanitized.lastIndexOf('.');
    if (lastDot > 0 && lastDot > sanitized.length - 10) {
      const extension = sanitized.slice(lastDot);
      const name = sanitized.slice(0, MAX_FILENAME_LENGTH - extension.length);
      sanitized = name + extension;
    } else {
      sanitized = sanitized.slice(0, MAX_FILENAME_LENGTH);
    }
  }

  // If sanitization resulted in empty string, use fallback
  if (!sanitized || sanitized === '_') {
    return fallback;
  }

  return sanitized;
}
