// src/lib/imageCompressor.ts
// Client-side image compression using HTML5 Canvas
// Reduces file size by 90-98% before uploading to Supabase or storing in database.

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0.1 to 1.0 (recommended: 0.75)
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressOptions = {
  maxWidth: 1280,
  maxHeight: 1280,
  quality: 0.75,
  mimeType: 'image/jpeg',
};

/**
 * Calculates byte size of a base64 DataURL
 */
export function getBase64SizeInBytes(dataUrl: string): number {
  if (!dataUrl || !dataUrl.includes(',')) return 0;
  const base64String = dataUrl.split(',')[1];
  const padding = (base64String.match(/=+$/) || [''])[0].length;
  return Math.floor((base64String.length * 3) / 4) - padding;
}

/**
 * Human-readable file size formatter (e.g. "84.2 KB", "1.4 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Loads an image from File, Blob, or DataURL into an HTMLImageElement
 */
function loadImage(source: File | Blob | string): Promise<{ img: HTMLImageElement; objectUrl?: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let objectUrl: string | undefined;

    if (typeof source === 'string') {
      img.src = source;
    } else {
      objectUrl = URL.createObjectURL(source);
      img.src = objectUrl;
    }

    img.onload = () => resolve({ img, objectUrl });
    img.onerror = (err) => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load image for compression: ' + String(err)));
    };
  });
}

/**
 * Compresses an image by resizing proportionally and re-encoding with JPEG compression.
 * Works seamlessly with mobile camera shots (5-15 MB) reducing them to ~50-120 KB.
 */
export async function compressImage(
  source: File | Blob | string,
  options?: CompressOptions
): Promise<string> {
  // If running in an environment without DOM (e.g. node unit tests), return string or throw gracefully
  if (typeof document === 'undefined') {
    return typeof source === 'string' ? source : '';
  }

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { img, objectUrl } = await loadImage(source);

  try {
    let { width, height } = img;
    const maxWidth = opts.maxWidth || 1280;
    const maxHeight = opts.maxHeight || 1280;
    const quality = opts.quality ?? 0.75;
    const mimeType = opts.mimeType || 'image/jpeg';

    // Scale dimensions while maintaining aspect ratio
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement('canvas');
    canvas.width = Math.max(width, 1);
    canvas.height = Math.max(height, 1);

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context not available for compression');
    }

    // Fill white background so transparent PNGs become clean white JPEG backgrounds
    if (mimeType === 'image/jpeg') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
    }

    ctx.drawImage(img, 0, 0, width, height);
    const compressedDataUrl = canvas.toDataURL(mimeType, quality);

    return compressedDataUrl;
  } finally {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
  }
}

/**
 * Optimized preset for customer avatars / profile photos:
 * Max 800x800 px, quality 0.75 -> Typically ~35 KB - 60 KB
 */
export async function compressCustomerAvatar(source: File | Blob | string): Promise<string> {
  return compressImage(source, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.75,
    mimeType: 'image/jpeg',
  });
}

/**
 * Optimized preset for NID and collateral photos (jewelry, deeds, vehicles):
 * Max 1280x1280 px, quality 0.75 -> Typically ~70 KB - 120 KB with crisp text & details
 */
export async function compressDocumentPhoto(source: File | Blob | string): Promise<string> {
  return compressImage(source, {
    maxWidth: 1280,
    maxHeight: 1280,
    quality: 0.75,
    mimeType: 'image/jpeg',
  });
}
