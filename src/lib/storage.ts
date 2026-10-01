// src/lib/storage.ts
// Private Supabase Storage manager with Signed URLs only (never public)

import { supabase, isSupabaseConfigured } from './supabase';

export type StorageBucket = 'customer-photos' | 'nid-docs' | 'collateral-photos';

/**
 * Uploads a base64 or File object to a private Supabase Storage bucket.
 * Returns the private file path (e.g. 'customers/123_1690000000.jpg').
 */
export async function uploadPrivateFile(
  bucket: StorageBucket,
  dataUrlOrFile: string | File,
  filenamePrefix: string = 'file'
): Promise<string> {
  if (!isSupabaseConfigured) {
    // In mock/offline mode, return the dataUrl as-is for local preview
    if (typeof dataUrlOrFile === 'string') return dataUrlOrFile;
    return URL.createObjectURL(dataUrlOrFile);
  }

  const timestamp = Date.now();
  let fileBlob: Blob;
  let ext = 'jpg';

  if (typeof dataUrlOrFile === 'string') {
    if (dataUrlOrFile.startsWith('data:')) {
      const parts = dataUrlOrFile.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      ext = mime.split('/')[1] || 'jpg';
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      fileBlob = new Blob([ab], { type: mime });
    } else {
      // It's already a URL or path
      return dataUrlOrFile;
    }
  } else {
    fileBlob = dataUrlOrFile;
    ext = dataUrlOrFile.name.split('.').pop() || 'jpg';
  }

  const filePath = `${filenamePrefix}_${timestamp}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(filePath, fileBlob, {
    cacheControl: '3600',
    upsert: true,
  });

  if (error) {
    console.error(`Failed to upload to ${bucket}:`, error);
    throw error;
  }

  return filePath;
}

// In-memory cache for signed URLs to minimize round-trips
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Generates a signed URL for a private storage object (valid for 1 hour).
 */
export async function getSignedUrl(
  bucket: StorageBucket,
  filePath: string | null | undefined
): Promise<string | null> {
  if (!filePath) return null;

  // If it's already a base64 or blob URL (from mock mode or camera preview), return directly
  if (filePath.startsWith('data:') || filePath.startsWith('blob:') || filePath.startsWith('http')) {
    return filePath;
  }

  const cacheKey = `${bucket}:${filePath}`;
  const cached = signedUrlCache.get(cacheKey);
  const now = Date.now();

  if (cached && cached.expiresAt > now + 60 * 1000) {
    return cached.url;
  }

  if (!isSupabaseConfigured) {
    return filePath;
  }

  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(filePath, 3600); // 1 hour validity

    if (error || !data?.signedUrl) {
      console.warn(`Could not generate signed URL for ${filePath}:`, error);
      return null;
    }

    signedUrlCache.set(cacheKey, {
      url: data.signedUrl,
      expiresAt: now + 3500 * 1000,
    });

    return data.signedUrl;
  } catch (err) {
    console.error('Error generating signed URL:', err);
    return null;
  }
}
