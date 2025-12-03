import sharp from 'sharp';

// Allowed MIME types for image uploads
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

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
