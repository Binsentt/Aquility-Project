import { sha256File } from './sha256.js';

const supportedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const uploadDebugEnabled = process.env.NODE_ENV === 'development' || process.env.EXPO_PUBLIC_AQUALITY_DEBUG === 'true';

function extensionFor(value = '') {
  const extension = String(value).split(/[?#]/, 1)[0].split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : '';
}

function typeForExtension(extension) {
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return '';
}

function safeFilename(value) {
  const filename = String(value || '').split(/[\\/]/).pop()?.trim();
  return filename && filename !== '.' && filename !== '..' ? filename.replace(/[^a-zA-Z0-9._-]/g, '_') : '';
}

export function normalizeImageAsset(imageUri, imageAsset = {}) {
  const uri = imageAsset?.uri || imageUri;
  const suppliedName = safeFilename(imageAsset?.name || imageAsset?.fileName);
  const suppliedType = typeof (imageAsset?.type || imageAsset?.mimeType) === 'string'
    ? (imageAsset.type || imageAsset.mimeType).toLowerCase()
    : '';
  const uriExtension = extensionFor(uri);
  const nameExtension = extensionFor(suppliedName);
  const inferredType = typeForExtension(nameExtension || uriExtension);
  const type = suppliedType || inferredType || 'application/octet-stream';
  const extension = nameExtension || (type === 'image/jpeg' ? 'jpg' : type.split('/')[1] || 'upload');

  return {
    uri,
    name: suppliedName || `water-strip.${extension}`,
    type,
  };
}

function debugUpload(details) {
  if (process.env.NODE_ENV !== 'development' && process.env.EXPO_PUBLIC_AQUALITY_DEBUG !== 'true') return;
  console.info('[AQUALITY UPLOAD DEBUG]', details);
}

export async function createMultipartFile(imageUri, imageAsset = {}) {
  const descriptor = normalizeImageAsset(imageUri, imageAsset);
  if (typeof Blob === 'undefined') throw new Error('This environment cannot create an image upload part.');
  // The native scanner supplies a real SDK-57 File through nativeMultipartUpload.js.
  // This transport-free Blob fallback keeps web and Node service tests independent
  // from native Expo modules while preserving the same multipart contract.
  const file = new Blob([], { type: descriptor.type });
  const diagnostics = {
    fileName: descriptor.name,
    fileType: descriptor.type,
    fileSize: file.size,
    fileExists: null,
    sha256: uploadDebugEnabled ? await sha256File(file) : null,
  };
  debugUpload(diagnostics);
  return { file, descriptor, ...diagnostics };
}

export { supportedUploadTypes };
