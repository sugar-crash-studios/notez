import { Client } from 'minio';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  id: string;
  url: string;
  width: number;
  height: number;
  size: number;
}

class StorageService {
  private client: Client | null = null;
  private bucket: string;
  private initialized = false;

  constructor() {
    this.bucket = process.env.MINIO_BUCKET || 'notez-images';
  }

  private getClient(): Client {
    if (!this.client) {
      // In production, require explicit credentials - no defaults allowed
      const isProduction = process.env.NODE_ENV === 'production';
      const accessKey = process.env.MINIO_ACCESS_KEY;
      const secretKey = process.env.MINIO_SECRET_KEY;

      if (isProduction && (!accessKey || !secretKey)) {
        throw new Error(
          'MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set in production environment'
        );
      }

      this.client = new Client({
        endPoint: process.env.MINIO_ENDPOINT || 'localhost',
        port: parseInt(process.env.MINIO_PORT || '9000', 10),
        useSSL: process.env.MINIO_USE_SSL === 'true',
        // Use provided credentials or development defaults
        accessKey: accessKey || 'notez',
        secretKey: secretKey || 'notez-secret',
      });
    }
    return this.client;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const client = this.getClient();
      const exists = await client.bucketExists(this.bucket);

      if (!exists) {
        await client.makeBucket(this.bucket);
        console.log(`📦 Created MinIO bucket: ${this.bucket}`);

        // Set bucket policy for authenticated read access via our API
        // Images are served through our API endpoint, not directly from MinIO
      }

      this.initialized = true;
      console.log(`📦 MinIO storage initialized (bucket: ${this.bucket})`);
    } catch (error) {
      console.error('❌ Failed to initialize MinIO storage:', error);
      throw error;
    }
  }

  async uploadImage(
    buffer: Buffer,
    mimeType: string,
    userId: string
  ): Promise<UploadResult> {
    const client = this.getClient();

    // Get original image metadata
    const metadata = await sharp(buffer).metadata();

    // Process image with sharp - resize large images and optimize
    let processed: Buffer;
    let outputMimeType = 'image/jpeg';
    let width = metadata.width || 0;
    let height = metadata.height || 0;

    // Handle GIFs specially - preserve animation by not converting
    if (mimeType === 'image/gif') {
      // For GIFs, just pass through without conversion to preserve animation
      // But still resize if too large
      if (width > 1920 || height > 1920) {
        processed = await sharp(buffer, { animated: true })
          .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        const resizedMeta = await sharp(processed).metadata();
        width = resizedMeta.width || width;
        height = resizedMeta.height || height;
      } else {
        processed = buffer;
      }
      outputMimeType = 'image/gif';
    } else if (mimeType === 'image/png' && metadata.hasAlpha) {
      // Preserve PNG with transparency
      processed = await sharp(buffer)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 85, compressionLevel: 9 })
        .toBuffer();
      const resizedMeta = await sharp(processed).metadata();
      width = resizedMeta.width || width;
      height = resizedMeta.height || height;
      outputMimeType = 'image/png';
    } else {
      // Convert to optimized JPEG for everything else
      processed = await sharp(buffer)
        .resize(1920, 1920, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const resizedMeta = await sharp(processed).metadata();
      width = resizedMeta.width || width;
      height = resizedMeta.height || height;
      outputMimeType = 'image/jpeg';
    }

    const id = uuidv4();
    const extension = outputMimeType === 'image/gif' ? 'gif' :
                      outputMimeType === 'image/png' ? 'png' : 'jpg';
    const key = `${userId}/${id}.${extension}`;

    await client.putObject(this.bucket, key, processed, processed.length, {
      'Content-Type': outputMimeType,
    });

    return {
      id,
      url: `/api/images/${id}`,
      width,
      height,
      size: processed.length,
    };
  }

  async getImage(id: string, userId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const client = this.getClient();

    // Try different extensions
    const extensions = ['jpg', 'png', 'gif'];

    for (const ext of extensions) {
      const key = `${userId}/${id}.${ext}`;
      try {
        const stream = await client.getObject(this.bucket, key);
        const chunks: Buffer[] = [];

        for await (const chunk of stream) {
          chunks.push(chunk as Buffer);
        }

        const mimeType = ext === 'gif' ? 'image/gif' :
                         ext === 'png' ? 'image/png' : 'image/jpeg';

        return {
          buffer: Buffer.concat(chunks),
          mimeType,
        };
      } catch {
        // Try next extension
        continue;
      }
    }

    return null;
  }

  async deleteImage(id: string, userId: string): Promise<boolean> {
    const client = this.getClient();

    // Try different extensions
    const extensions = ['jpg', 'png', 'gif'];

    for (const ext of extensions) {
      const key = `${userId}/${id}.${ext}`;
      try {
        await client.removeObject(this.bucket, key);
        return true;
      } catch {
        continue;
      }
    }

    return false;
  }

  async deleteUserImages(userId: string): Promise<void> {
    const client = this.getClient();
    const prefix = `${userId}/`;

    const objectsList = client.listObjects(this.bucket, prefix, true);
    const objectsToDelete: string[] = [];

    for await (const obj of objectsList) {
      if (obj.name) {
        objectsToDelete.push(obj.name);
      }
    }

    if (objectsToDelete.length > 0) {
      await client.removeObjects(this.bucket, objectsToDelete);
    }
  }

  /**
   * Upload user avatar - stored in avatars/ folder
   * Avatars are resized to 256x256 and converted to JPEG
   */
  async uploadAvatar(
    buffer: Buffer,
    userId: string
  ): Promise<{ url: string }> {
    const client = this.getClient();

    // Process avatar - resize to 256x256 square, convert to JPEG
    // .rotate() without arguments auto-orients based on EXIF and strips metadata (privacy)
    const processed = await sharp(buffer)
      .rotate() // Auto-orient and strip EXIF metadata for privacy
      .resize(256, 256, { fit: 'cover' })
      .jpeg({ quality: 90 })
      .toBuffer();

    const key = `avatars/${userId}.jpg`;

    await client.putObject(this.bucket, key, processed, processed.length, {
      'Content-Type': 'image/jpeg',
    });

    return {
      url: `/api/profile/avatar/${userId}`,
    };
  }

  /**
   * Get user avatar
   */
  async getAvatar(userId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
    const client = this.getClient();
    const key = `avatars/${userId}.jpg`;

    try {
      const stream = await client.getObject(this.bucket, key);
      const chunks: Buffer[] = [];

      for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
      }

      return {
        buffer: Buffer.concat(chunks),
        mimeType: 'image/jpeg',
      };
    } catch {
      return null;
    }
  }

  /**
   * Delete user avatar
   */
  async deleteAvatar(userId: string): Promise<boolean> {
    const client = this.getClient();
    const key = `avatars/${userId}.jpg`;

    try {
      await client.removeObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }
}

export const storageService = new StorageService();
