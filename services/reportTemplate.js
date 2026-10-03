import { canonicalizeSampleClass, canonicalizeSampleCode } from './sampleSites.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(4) : 'Unavailable';
}

function formatDate(value) {
  if (!value) return 'Unavailable';
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? 'Unavailable' : parsed.toLocaleString();
}

function formatRgb(value) {
  if (!Array.isArray(value) || value.length !== 3 || value.some((channel) => !Number.isFinite(Number(channel)))) {
    return 'Unavailable';
  }
  return value.map((channel) => String(Number(channel))).join(', ');
}

function cleanClientRemarks(value) {
  const remarks = typeof value === 'string' ? value : '';
  if (/client-provided provisional references|provisional client reference colors|analytically validated method|HSV H\/S\/V|scientific (?:validation|comparison)|laboratory (?:comparison|validation)|certified water-safety/i.test(remarks)) {
    return 'Separate µPAD sensing areas were localized. Results are shown only when a configured reference matches.';
  }
  return remarks || 'Unavailable';
}

export function buildPdfHtml({ user = {}, test = {}, brandImageUri = null } = {}) {
  const location = test.location || test.gps || null;
  const latitude = formatCoordinate(location?.latitude);
  const longitude = formatCoordinate(location?.longitude);
  const mapUrl = location ? `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}` : null;
  const results = test.resultData || {};
  const stripImage = test.imageUri || test.image || test.uri || test.images?.[0] || null;
  const reactionTime = test.reactionTime ?? test.immersionTime ?? null;
  const pHStatus = test.phStatus || test.pHResult?.status || 'Unavailable';
  const nitriteStatus = test.nitriteStatus || test.nitrite?.status || 'Unavailable';
  const sampleClass = canonicalizeSampleClass(test.sampleClass) || test.sampleClass || 'Unknown';
  const sampleCode = canonicalizeSampleCode(test.sampleCode) || test.sampleCode || 'Unavailable';
  const roiColors = `pH ROI median RGB: ${formatRgb(test.pHResult?.measuredRGB)}; Nitrite ROI median RGB: ${formatRgb(test.nitrite?.measuredRGB)}`;

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; padding: 28px; color: #17324B; line-height: 1.45;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 22px;">
          ${brandImageUri ? `<img data-brand-logo="aquality" src="${escapeHtml(brandImageUri)}" style="width: 48px; height: 48px; object-fit: contain;" />` : ''}
          <div>
            <h1 style="font-size: 28px; margin: 0 0 4px;">AQUALITY Water Test Report</h1>
            <p style="margin: 0; color: #4D6478;">Water-quality test report generated from an AQUALITY record.</p>
          </div>
        </div>
        <h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">User Information</h2>
        <p><strong>Name:</strong> ${escapeHtml(user.fullName || 'Unavailable')}<br>
        <strong>Email:</strong> ${escapeHtml(user.email || 'Unavailable')}<br>
        <strong>Phone:</strong> ${escapeHtml(user.phoneNumber || user.contactNumber || 'Unavailable')}<br>
        <strong>Barangay:</strong> ${escapeHtml(user.barangay || test.barangay || 'Unavailable')}<br>
        <strong>Municipality:</strong> ${escapeHtml(user.municipality || test.municipality || 'Unavailable')}</p>
        <h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">Test Information</h2>
        <p><strong>Date and time:</strong> ${escapeHtml(formatDate(test.capturedAt || test.generatedAt || test.createdAt))}<br>
        <strong>GPS coordinates:</strong> ${escapeHtml(`${latitude}, ${longitude}`)}<br>
        <strong>Sample code:</strong> ${escapeHtml(sampleCode)}<br>
        <strong>Sample number:</strong> ${escapeHtml(test.sampleNumber == null ? 'Unavailable' : test.sampleNumber)}<br>
        <strong>Sample class:</strong> ${escapeHtml(sampleClass)}<br>
        <strong>Sampling site:</strong> ${escapeHtml(test.siteName || 'Unknown sampling site')}<br>
        <strong>Water source:</strong> ${escapeHtml(test.sourceType || 'Unknown')}<br>
        <strong>Reaction/immersion time:</strong> ${escapeHtml(reactionTime == null ? 'Not supplied' : reactionTime)}${mapUrl ? `<br><strong>Map location:</strong> <a href="${escapeHtml(mapUrl)}">Open map location</a>` : ''}</p>
        ${stripImage ? `<h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">Captured Test Strip</h2><img src="${escapeHtml(stripImage)}" style="width: 100%; max-height: 320px; object-fit: contain; border-radius: 10px; border: 1px solid #D8E6EE;">` : ''}
        <h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">Estimated Results</h2>
        <p><strong>pH:</strong> ${escapeHtml(results.pH || 'Unavailable')}<br>
        <strong>Nitrite:</strong> ${escapeHtml(results.Nitrite || 'Unavailable')}<br>
        <strong>pH Status:</strong> ${escapeHtml(pHStatus)}<br>
        <strong>Nitrite Status:</strong> ${escapeHtml(nitriteStatus)}<br>
        <strong>Scan Status:</strong> ${escapeHtml(test.scanStatus || 'Unavailable')}<br>
        <strong>Overall Water Status:</strong> ${escapeHtml(test.overallStatus || 'NOT CLASSIFIED')}<br>
        <strong>Measured Parameters Status:</strong> ${escapeHtml(test.measuredParametersStatus || results['Measured Parameters Status'] || 'Not classified')}<br>
        <strong>Remarks:</strong> ${escapeHtml(cleanClientRemarks(test.remarks || test.summary))}</p>
        <h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">Analysis Evidence</h2>
        <p>${escapeHtml(roiColors)}</p>
      </body>
    </html>
  `;
}
