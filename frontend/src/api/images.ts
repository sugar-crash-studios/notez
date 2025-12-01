// Image API for uploading and managing images in notes
// Uses fetch directly for FormData uploads (axios doesn't handle multipart well)

// API base URL - use environment variable or default to relative path for production
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '');

export interface UploadImageResult {
  success: boolean;
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface ImageInfo {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  noteId: string | null;
  createdAt: string;
}

export interface ListImagesResult {
  images: ImageInfo[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Upload an image file
 */
export async function uploadImage(file: File): Promise<UploadImageResult> {
  const formData = new FormData();
  formData.append('file', file);

  // Get token from localStorage (same key as api.ts)
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/api/images/upload`, {
    method: 'POST',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    credentials: 'include',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(error.message || 'Failed to upload image');
  }

  return response.json();
}

/**
 * Delete an image
 */
export async function deleteImage(id: string): Promise<void> {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`${API_BASE_URL}/api/images/${id}`, {
    method: 'DELETE',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Delete failed' }));
    throw new Error(error.message || 'Failed to delete image');
  }
}

/**
 * List user's images
 */
export async function listImages(params?: {
  noteId?: string;
  limit?: number;
  offset?: number;
}): Promise<ListImagesResult> {
  const token = localStorage.getItem('accessToken');
  const searchParams = new URLSearchParams();

  if (params?.noteId) searchParams.set('noteId', params.noteId);
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.offset) searchParams.set('offset', String(params.offset));

  const queryString = searchParams.toString();
  const url = `${API_BASE_URL}/api/images${queryString ? `?${queryString}` : ''}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to list images');
  }

  return response.json();
}
