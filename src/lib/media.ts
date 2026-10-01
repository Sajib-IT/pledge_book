// src/lib/media.ts
import { Camera as CapCamera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

/**
 * Capture a photo directly from the device camera.
 * Returns the base64 dataUrl string, or null if cancelled or on web.
 */
export async function captureFromCamera(quality: number = 85): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await CapCamera.getPhoto({
        quality,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });
      return image?.dataUrl || null;
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
 * Pick a photo directly from the device gallery / photo library.
 * Returns the base64 dataUrl string, or null if cancelled or on web.
 */
export async function pickFromGallery(quality: number = 85): Promise<string | null> {
  if (Capacitor.isNativePlatform()) {
    try {
      const image = await CapCamera.getPhoto({
        quality,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
      });
      return image?.dataUrl || null;
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
 * Reads a File object from an HTML input as base64 DataUrl.
 */
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
