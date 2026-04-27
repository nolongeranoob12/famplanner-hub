import { Capacitor } from '@capacitor/core';
import { Camera, CameraDirection, EncodingType, MediaTypeSelection, type MediaResult } from '@capacitor/camera';

export type NativePhotoResult =
  | { ok: true; file: File; previewUrl: string }
  | { ok: false; reason: 'denied' | 'cancelled' | 'failed'; message: string };

const photoOptions = {
  quality: 82,
  targetWidth: 1600,
  targetHeight: 1600,
  correctOrientation: true,
  presentationStyle: 'fullscreen' as const,
  includeMetadata: true,
};

function isDenied(state: string | undefined) {
  return state === 'denied' || state === 'restricted';
}

async function mediaResultToFile(photo: MediaResult, source: 'camera' | 'library') {
  const url = photo.webPath ?? photo.uri;
  if (!url) throw new Error('Photo did not return a readable file');

  const response = await fetch(url);
  const blob = await response.blob();
  const format = photo.metadata?.format?.replace('jpeg', 'jpg') || 'jpg';
  const file = new File([blob], `activity-${source}-${Date.now()}.${format}`, {
    type: blob.type || `image/${format === 'jpg' ? 'jpeg' : format}`,
  });

  return { file, previewUrl: URL.createObjectURL(blob) };
}

async function chooseFromLibrary(): Promise<NativePhotoResult> {
  let permissions = await Camera.checkPermissions();
  if (permissions.photos === 'prompt') {
    permissions = await Camera.requestPermissions({ permissions: ['photos'] });
  }

  if (isDenied(permissions.photos)) {
    return {
      ok: false,
      reason: 'denied',
      message: 'Photo access is off. Please allow Photos in Settings, then try again.',
    };
  }

  const gallery = await Camera.chooseFromGallery({
    ...photoOptions,
    mediaType: MediaTypeSelection.Photo,
    allowMultipleSelection: false,
    limit: 1,
  });

  const photo = gallery.results[0];
  if (!photo) {
    return { ok: false, reason: 'cancelled', message: 'No photo was selected.' };
  }

  return { ok: true, ...(await mediaResultToFile(photo, 'library')) };
}

export async function captureNativePhoto(): Promise<NativePhotoResult> {
  if (!Capacitor.isNativePlatform()) {
    return { ok: false, reason: 'failed', message: 'Native camera is only available in the installed app.' };
  }

  try {
    let permissions = await Camera.checkPermissions();
    if (permissions.camera === 'prompt') {
      permissions = await Camera.requestPermissions({ permissions: ['camera'] });
    }

    if (isDenied(permissions.camera)) {
      return chooseFromLibrary();
    }

    try {
      const photo = await Camera.takePhoto({
        ...photoOptions,
        encodingType: EncodingType.JPEG,
        cameraDirection: CameraDirection.Rear,
        saveToGallery: false,
      });
      return { ok: true, ...(await mediaResultToFile(photo, 'camera')) };
    } catch (error) {
      const message = String((error as Error)?.message ?? error).toLowerCase();
      if (message.includes('cancel')) {
        return { ok: false, reason: 'cancelled', message: 'Photo capture was cancelled.' };
      }
      return chooseFromLibrary();
    }
  } catch (error) {
    console.error('[NativePhoto] capture failed', error);
    return {
      ok: false,
      reason: 'failed',
      message: 'Could not open the camera or photos. Please check permissions in Settings.',
    };
  }
}