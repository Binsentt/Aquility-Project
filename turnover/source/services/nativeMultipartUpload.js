import { File, Paths } from 'expo-file-system';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { fetch as expoFetch } from 'expo/fetch';
import { normalizeImageAsset, supportedUploadTypes } from './multipartUpload.js';
import { sha256File } from './sha256.js';

const convertibleUploadTypes = new Set(['image/heic', 'image/heif']);
const uploadDebugEnabled = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_AQUALITY_DEBUG === 'true';

function cacheFileUri(cacheDirectory, filename) {
  const base = String(cacheDirectory || '').replace(/\/$/, '');
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${base}/aquality-upload-${suffix}-${filename}`;
}

async function normalizeUnsupportedImage(sourceUri, descriptor) {
  if (!convertibleUploadTypes.has(descriptor.type)) return { uri: sourceUri, descriptor };

  try {
    const converted = await ImageManipulator.manipulateAsync(sourceUri, [], {
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    const name = descriptor.name.replace(/\.(heic|heif)$/i, '.jpg');
    return { uri: converted.uri, descriptor: { ...descriptor, name, type: 'image/jpeg' } };
  } catch (cause) {
    throw Object.assign(new Error('The selected image format could not be converted for upload.'), {
      code: 'INVALID_IMAGE',
      cause,
    });
  }
}

/**
 * Prepare an SDK-57 File for React Native FormData. This module is imported
 * statically by the scanner so Expo modules are resolved when Metro builds the
 * app, never through a lazy import when Analyze is pressed.
 */
export async function prepareNativeMultipartFile(imageUri, imageAsset = {}) {
  const descriptor = normalizeImageAsset(imageUri, imageAsset);
  const normalized = await normalizeUnsupportedImage(descriptor.uri, descriptor);
  let sourceUri = normalized.uri;

  if (!sourceUri.startsWith('file://')) {
    const cacheDirectory = Paths?.cache?.uri || LegacyFileSystem.cacheDirectory;
    if (!LegacyFileSystem.copyAsync || !cacheDirectory) {
      throw Object.assign(new Error('The selected image could not be opened for upload.'), { code: 'IMAGE_UNREADABLE' });
    }
    sourceUri = cacheFileUri(cacheDirectory, normalized.descriptor.name);
    await LegacyFileSystem.copyAsync({ from: normalized.uri, to: sourceUri });
  }

  const file = new File(sourceUri);
  if (!file.exists || file.size <= 0) {
    throw Object.assign(new Error('The selected image is unavailable or empty.'), { code: 'IMAGE_UNREADABLE' });
  }

  const fileType = file.type || normalized.descriptor.type;
  if (!supportedUploadTypes.has(fileType)) {
    throw Object.assign(new Error('Please select a JPEG, PNG, or WebP image of the water-test strip.'), { code: 'INVALID_IMAGE' });
  }

  return {
    file,
    descriptor: { ...normalized.descriptor, name: file.name || normalized.descriptor.name, type: fileType },
    fileName: file.name || normalized.descriptor.name,
    fileType,
    fileSize: file.size,
    fileExists: file.exists,
    sha256: uploadDebugEnabled ? await sha256File(file) : null,
  };
}

export const nativeMultipartFetch = expoFetch;
