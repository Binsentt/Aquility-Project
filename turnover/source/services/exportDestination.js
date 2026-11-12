import { canonicalizeSampleCode } from './sampleSites.js';

function safeSegment(value, fallback) {
  const safe = String(value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    .slice(0, 48);
  return safe || fallback;
}

function dateStamp(value) {
  const parsed = value ? new Date(value) : null;
  return parsed && Number.isFinite(parsed.valueOf()) ? parsed.toISOString().slice(0, 10) : 'undated';
}

export function buildExportFileName({ sampleCode, id, capturedAt, createdAt, generatedAt, extension } = {}) {
  const normalizedExtension = String(extension ?? '').replace(/^\./, '').toLowerCase();
  if (!['pdf', 'png'].includes(normalizedExtension)) throw new TypeError('Export filename extension must be pdf or png.');
  const code = canonicalizeSampleCode(sampleCode) || sampleCode || id || 'WATER-TEST';
  const safeCode = safeSegment(code, 'WATER-TEST');
  return `AQUALITY_${safeCode}_${dateStamp(capturedAt || createdAt || generatedAt)}.${normalizedExtension}`;
}

export function assertBackendReportPayload(payload = {}) {
  const imageUri = payload.imageUri || payload.image || payload.uri || payload.images?.[0];
  const resultData = payload.resultData || {};
  if (!payload.id) throw new Error('This report is not linked to a saved AQUALITY water-test record. Refresh the result and try again.');
  if (!imageUri) throw new Error('The captured water-test image is unavailable. Refresh the result and try again.');
  if (!resultData.pH || !resultData.Nitrite) {
    throw new Error('The saved water-test analysis is incomplete. Refresh the result and try again.');
  }
  return imageUri;
}

function decodeSafName(value) {
  const lastSegment = String(value ?? '').split(/[\\/]/).at(-1)?.split('?')[0] || '';
  let decoded = lastSegment;
  try { decoded = decodeURIComponent(lastSegment); } catch { /* Keep the original URI segment. */ }
  return decoded.split(/[\\/]/).at(-1) || decoded;
}

export function nextAvailableExportFileName(fileName, existingEntries = []) {
  const rawName = String(fileName ?? '');
  const extensionIndex = rawName.lastIndexOf('.');
  const rawExtension = extensionIndex > 0 ? rawName.slice(extensionIndex).toLowerCase() : '';
  const extension = ['.pdf', '.png'].includes(rawExtension) ? rawExtension : '';
  const stem = safeSegment(extension ? rawName.slice(0, extensionIndex) : rawName, 'AQUALITY_export');
  const safeName = `${stem}${extension}`;
  const names = new Set(existingEntries.map((entry) => decodeSafName(entry).toLowerCase()));
  if (!names.has(safeName.toLowerCase())) return safeName;
  let suffix = 2;
  while (names.has(`${stem}_${suffix}${extension}`.toLowerCase())) suffix += 1;
  return `${stem}_${suffix}${extension}`;
}

/**
 * Save a generated private file into a user-selected Android SAF directory.
 * Dependencies are injected so cancellation, persistence, and failure
 * behavior can be tested without a native device.
 */
export async function saveExportToDirectory(exported, fileSystem) {
  if (!exported?.uri || !exported?.fileName || !exported?.mimeType) {
    throw new TypeError('A generated export URI, filename, and MIME type are required.');
  }

  const permission = await fileSystem.requestDirectoryPermissionsAsync();
  if (!permission?.granted || !permission.directoryUri) {
    return { status: 'not_saved', fileName: exported.fileName };
  }

  const existingEntries = await fileSystem.readDirectoryAsync(permission.directoryUri);
  const fileName = nextAvailableExportFileName(exported.fileName, existingEntries);
  const extensionIndex = fileName.lastIndexOf('.');
  const fileNameWithoutExtension = extensionIndex > 0 ? fileName.slice(0, extensionIndex) : fileName;
  let destinationUri = null;

  try {
    destinationUri = await fileSystem.createFileAsync(permission.directoryUri, fileNameWithoutExtension, exported.mimeType);
    if (!destinationUri) throw new Error('No export destination file was created.');

    const base64 = await fileSystem.readAsStringAsync(exported.uri, { encoding: 'base64' });
    if (typeof base64 !== 'string' || !base64.length) throw new Error('The generated export was empty.');
    await fileSystem.writeAsStringAsync(destinationUri, base64, { encoding: 'base64' });

    const info = await fileSystem.getInfoAsync(destinationUri);
    let hasContent = Number.isFinite(info?.size) ? info.size > 0 : false;
    if (!hasContent && info?.exists && !Number.isFinite(info.size)) {
      const writtenBase64 = await fileSystem.readAsStringAsync(destinationUri, { encoding: 'base64' });
      hasContent = typeof writtenBase64 === 'string' && writtenBase64.length > 0;
    }
    if (!info?.exists || !hasContent) throw new Error('The exported file could not be verified after saving.');

    return { status: 'saved', uri: destinationUri, fileName };
  } catch {
    if (destinationUri) {
      try { await fileSystem.deleteAsync(destinationUri); } catch { /* Best-effort cleanup of a partial export. */ }
    }
    throw new Error('Unable to save the export in the selected folder. No success was reported.');
  }
}

export function exportCompletionNotice(kind, outcome) {
  if (outcome?.status !== 'saved' || !outcome.fileName) return null;
  return {
    title: `${kind} saved`,
    message: `${outcome.fileName} is available in the folder you selected.`,
  };
}

export function exportOutcomeNotice(kind, outcome) {
  const completion = exportCompletionNotice(kind, outcome);
  if (completion) return completion;
  if (outcome?.status !== 'not_saved') return null;
  return {
    title: 'Save not completed',
    message: 'No folder was selected or folder access was not granted. No file was saved.',
  };
}
