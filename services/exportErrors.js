const safeExportMessages = new Set([
  'No image is available to export.',
  'This report is not linked to a saved AQUILITY water-test record. Refresh the result and try again.',
  'The captured water-test image is unavailable. Refresh the result and try again.',
  'The saved water-test analysis is incomplete. Refresh the result and try again.',
  'Sharing is not available on this device.',
]);

export function toSafeExportMessage(error, fallback) {
  const message = typeof error?.message === 'string' ? error.message : '';
  return safeExportMessages.has(message) ? message : fallback;
}
