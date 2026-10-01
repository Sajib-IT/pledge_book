// src/lib/media.ts
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';
import { compressImage } from './imageCompressor';

/**
 * Capture a photo directly from the device camera and compress it.
 * Returns the compressed base64 dataUrl string, or null if cancelled or on web.
 */
export async function captureFromCamera(quality: number = 75): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await CapCamera.getPhoto({
        quality: 85, // Native capture quality
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      if (!image?.dataUrl) return null;
      // Proactively compress to target dimensions & quality
      return await compressImage(image.dataUrl, { maxWidth: 1280, maxHeight: 1280, quality: quality / 100 });
    } catch (err: any) {
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        return null;
      }
      console.warn('Native camera capture error, falling back:', err);
      return null;
    }
  }
  return null;
}

/**
 * Pick a photo directly from the device gallery / photo library and compress it.
 * Returns the compressed base64 dataUrl string, or null if cancelled or on web.
 */
export async function pickFromGallery(quality: number = 75): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await CapCamera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });
      if (!image?.dataUrl) return null;
      return await compressImage(image.dataUrl, { maxWidth: 1280, maxHeight: 1280, quality: quality / 100 });
    } catch (err: any) {
      if (err?.message?.includes('cancelled') || err?.message?.includes('canceled')) {
        return null;
      }
      console.warn('Native gallery pick error, falling back:', err);
      return null;
    }
  }
  return null;
}

/**
 * Reads a File object and compresses it to lightweight base64 DataUrl (<100KB).
 */
export async function readFileAsDataUrl(file: File, quality: number = 75): Promise<string> {
  try {
    return await compressImage(file, { maxWidth: 1280, maxHeight: 1280, quality: quality / 100 });
  } catch (err) {
    console.warn('Canvas compression fallback to raw read:', err);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
}

