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

export function buildPdfHtml({ user = {}, test = {}, brandImageUri = null } = {}) {
  const location = test.location || test.gps || null;
  const latitude = formatCoordinate(location?.latitude);
  const longitude = formatCoordinate(location?.longitude);
  const mapUrl = location ? `https://www.google.com/maps?q=${encodeURIComponent(`${location.latitude},${location.longitude}`)}` : null;
  const results = test.resultData || {};
  const stripImage = test.imageUri || test.image || test.uri || test.images?.[0] || null;

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: Arial, sans-serif; padding: 28px; color: #17324B; line-height: 1.45;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 22px;">
          ${brandImageUri ? `<img data-brand-logo="aquility" src="${escapeHtml(brandImageUri)}" style="width: 48px; height: 48px; object-fit: contain;" />` : ''}
          <div>
            <h1 style="font-size: 28px; margin: 0 0 4px;">AQUILITY Water Test Report</h1>
            <p style="margin: 0; color: #4D6478;">Water-quality test report generated from an AQUILITY record.</p>
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
        <strong>GPS coordinates:</strong> ${escapeHtml(`${latitude}, ${longitude}`)}${mapUrl ? `<br><strong>Map location:</strong> <a href="${escapeHtml(mapUrl)}">Open map location</a>` : ''}</p>
        ${stripImage ? `<h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">Captured Test Strip</h2><img src="${escapeHtml(stripImage)}" style="width: 100%; max-height: 320px; object-fit: contain; border-radius: 10px; border: 1px solid #D8E6EE;">` : ''}
        <h2 style="font-size: 18px; border-bottom: 1px solid #D8E6EE; padding-bottom: 6px;">Estimated Results</h2>
        <p><strong>pH:</strong> ${escapeHtml(results.pH || 'Unavailable')}<br>
        <strong>Nitrate:</strong> ${escapeHtml(results.Nitrate || 'Unavailable')}<br>
        <strong>Overall Water Quality:</strong> ${escapeHtml(test.overallStatus || test.status || 'Unavailable')}<br>
        <strong>Remarks:</strong> ${escapeHtml(test.remarks || test.summary || 'Unavailable')}</p>
      </body>
    </html>
  `;
}
