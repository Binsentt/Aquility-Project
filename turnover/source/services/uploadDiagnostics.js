export function createUploadDiagnostics({
  captureUri,
  filename,
  fileSize,
  mimeType,
  pixelWidth,
  pixelHeight,
  source,
  sha256,
}) {
  return {
    captureUri: captureUri || null,
    filename: filename || null,
    fileSize: Number.isFinite(fileSize) ? fileSize : null,
    mimeType: mimeType || null,
    pixelWidth: Number.isFinite(pixelWidth) ? pixelWidth : null,
    pixelHeight: Number.isFinite(pixelHeight) ? pixelHeight : null,
    source: source || 'unknown',
    sha256: sha256 || null,
  };
}
