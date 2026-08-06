import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import * as Print from 'expo-print';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Sharing from 'expo-sharing';
import { buildPdfHtml } from './reportTemplate';
import { toSafeExportMessage } from './exportErrors';

const brandLogoSource = require('../assets/Aquility-Logo.png');

function normalizeLocalUri(uri) {
  if (!uri || typeof uri !== 'string') {
    return uri;
  }

  if (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('data:') ||
    uri.startsWith('http://') ||
    uri.startsWith('https://')
  ) {
    return uri;
  }

  if (uri.startsWith('/')) {
    return `file://${uri}`;
  }

  return uri;
}

function getUriScheme(uri) {
  if (!uri || typeof uri !== 'string') {
    return null;
  }

  try {
    return new URL(uri).protocol;
  } catch {
    return uri.split(':')[0].toLowerCase();
  }
}

function getExportDirectory() {
  return FileSystem.documentDirectory ? `${FileSystem.documentDirectory}exports/` : `${FileSystem.cacheDirectory || ''}exports/`;
}

async function resolvePdfBrandImageUri() {
  try {
    const asset = Asset.fromModule(brandLogoSource);
    await asset.downloadAsync();
    const localUri = asset.localUri || asset.uri;

    if (!localUri) {
      return null;
    }

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return base64 ? `data:image/png;base64,${base64}` : null;
  } catch (error) {
    return null;
  }
}

async function ensureExportsDirectory() {
  const exportDir = getExportDirectory();
  await FileSystem.makeDirectoryAsync(exportDir, { intermediates: true });
  return exportDir;
}

async function createLocalImageCopy(sourceUri, targetUri) {
  const result = await ImageManipulator.manipulateAsync(sourceUri, [], {
    compress: 0.92,
    format: ImageManipulator.SaveFormat.PNG,
  });

  if (!result?.uri) {
    throw new Error('The source image could not be converted into a local file.');
  }

  await FileSystem.copyAsync({ from: result.uri, to: targetUri });
  return targetUri;
}

async function resolveExportImageUri(imageUri) {
  if (!imageUri || typeof imageUri !== 'string') {
    throw new Error('No image is available to export.');
  }

  const normalizedSourceUri = normalizeLocalUri(imageUri);
  const scheme = getUriScheme(normalizedSourceUri);

  if (scheme === 'file') {
    const sourceInfo = await FileSystem.getInfoAsync(normalizedSourceUri);

    if (sourceInfo?.exists && typeof sourceInfo.size === 'number' && sourceInfo.size > 0) {
      return normalizedSourceUri;
    }
  }

  const exportDir = await ensureExportsDirectory();
  const targetUri = `${exportDir}resolved_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.png`;

  if (scheme === 'http' || scheme === 'https') {
    await FileSystem.downloadAsync(normalizedSourceUri, targetUri, { idempotent: true });
  } else if (scheme === 'file' || scheme === 'data') {
    await FileSystem.copyAsync({ from: normalizedSourceUri, to: targetUri });
  } else {
    await createLocalImageCopy(normalizedSourceUri, targetUri);
  }

  const resolvedInfo = await FileSystem.getInfoAsync(targetUri);

  if (!resolvedInfo?.exists || (typeof resolvedInfo.size === 'number' && resolvedInfo.size <= 0)) {
    throw new Error(`Unable to resolve the source image into a readable local file. Checked URI: ${targetUri}`);
  }

  return targetUri;
}

async function verifyFileExists(uri) {
  if (!uri) {
    throw new Error('No export file path was generated.');
  }

  const normalizedUri = normalizeLocalUri(uri);
  const info = await FileSystem.getInfoAsync(normalizedUri);

  if (!info.exists) {
    throw new Error(`The export file could not be created. Checked URI: ${normalizedUri}`);
  }

  if (typeof info.size === 'number' && info.size <= 0) {
    throw new Error(`The export file exists but is empty. Checked URI: ${normalizedUri}`);
  }

  return normalizedUri;
}

function shouldSkipFilesystemProbe(uri) {
  if (typeof uri !== 'string') {
    return false;
  }

  return uri.startsWith('content://') || uri.startsWith('ph://');
}

function assertBackendReportPayload(payload = {}) {
  const imageUri = payload.imageUri || payload.image || payload.uri || payload.images?.[0];
  const resultData = payload.resultData || {};
  if (!payload.id) throw new Error('This report is not linked to a saved AQUILITY water-test record. Refresh the result and try again.');
  if (!imageUri) throw new Error('The captured water-test image is unavailable. Refresh the result and try again.');
  if (!resultData.pH || !resultData.Nitrate || !resultData['Copper (Cu²⁺)']) {
    throw new Error('The saved water-test analysis is incomplete. Refresh the result and try again.');
  }
}

export async function createPdfExport(payload = {}) {
  try {
    assertBackendReportPayload(payload);
    const exportDir = await ensureExportsDirectory();
    const targetUri = `${exportDir}AQUILITY_Report_${Date.now()}.pdf`;
    const brandImageUri = await resolvePdfBrandImageUri();
    const html = buildPdfHtml({ user: payload?.user, test: payload, brandImageUri });

    if (!html.trim()) {
      throw new Error('PDF content was empty.');
    }

    const { uri: sourceUri } = await Print.printToFileAsync({ html, base64: false });

    if (!sourceUri) {
      throw new Error('The PDF generator did not return a file URI.');
    }

    await FileSystem.copyAsync({ from: sourceUri, to: targetUri });
    const verifiedUri = await verifyFileExists(targetUri);

    return {
      uri: verifiedUri,
      fileName: 'AQUILITY_Report.pdf',
    };
  } catch (error) {
    throw new Error(toSafeExportMessage(error, 'Unable to generate the PDF report.'));
  }
}

export async function createPngExport(imageUri) {
  try {
    const resolvedSourceUri = await resolveExportImageUri(imageUri);

    const exportDir = await ensureExportsDirectory();
    const targetUri = `${exportDir}AQUILITY_Image_${Date.now()}.png`;
    const result = await ImageManipulator.manipulateAsync(resolvedSourceUri, [], {
      compress: 0.92,
      format: ImageManipulator.SaveFormat.PNG,
    });

    if (!result?.uri) {
      throw new Error('The image manipulator did not return a file URI.');
    }

    await FileSystem.copyAsync({ from: result.uri, to: targetUri });
    const verifiedUri = await verifyFileExists(targetUri);

    return {
      uri: verifiedUri,
      fileName: 'AQUILITY_Image.png',
    };
  } catch (error) {
    throw new Error(toSafeExportMessage(error, 'Unable to create the PNG export.'));
  }
}

export async function shareExportFile(uri, message = 'AQUILITY export') {
  try {
    const verifiedUri = await verifyFileExists(uri);
    const isAvailable = await Sharing.isAvailableAsync();
    const isPdf = verifiedUri.toLowerCase().endsWith('.pdf');

    if (!isAvailable) {
      throw new Error('Sharing is not available on this device.');
    }

    await Sharing.shareAsync(verifiedUri, {
      mimeType: isPdf ? 'application/pdf' : 'image/png',
      dialogTitle: message,
      UTI: isPdf ? 'com.adobe.pdf' : 'public.png',
    });
  } catch (error) {
    throw new Error(toSafeExportMessage(error, 'The export could not be shared.'));
  }
}
