import { HttpError } from '../middleware/errorHandler.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value, field, { required = false, maxLength = 160 } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, `${field.toUpperCase().replace(/\s+/g, '_')}_REQUIRED`, `${field} is required.`);
    return null;
  }
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_INPUT', `${field} must be text.`);
  const normalized = value.trim();
  if (!normalized && required) throw new HttpError(400, `${field.toUpperCase()}_REQUIRED`, `${field} is required.`);
  if (normalized.length > maxLength) throw new HttpError(400, 'INVALID_INPUT', `${field} is too long.`);
  return normalized || null;
}

export function assertUuid(value, field = 'ID') {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new HttpError(400, 'INVALID_ID', `${field} must be a valid identifier.`);
  }
  return value;
}

export function validateEmail(value, { required = false } = {}) {
  const email = text(value, 'Email', { required, maxLength: 254 });
  if (email && !EMAIL_PATTERN.test(email)) throw new HttpError(400, 'INVALID_EMAIL', 'Email must be valid.');
  return email?.toLowerCase() || null;
}

export function validatePhoneNumber(value) {
  const phoneNumber = text(value, 'Phone number', { maxLength: 40 });
  if (!phoneNumber) return null;
  const normalized = phoneNumber.replace(/[\s()-]/g, '');
  if (!/^\+?[0-9]{10,15}$/.test(normalized)) {
    throw new HttpError(400, 'INVALID_PHONE_NUMBER', 'Phone number must be valid.');
  }
  return normalized;
}

export function validatePassword(value, { required = false } = {}) {
  if (value == null || value === '') {
    if (required) throw new HttpError(400, 'PASSWORD_REQUIRED', 'Password is required.');
    return null;
  }
  if (typeof value !== 'string' || value.length < 8 || value.length > 128) {
    throw new HttpError(400, 'INVALID_PASSWORD', 'Password must contain 8 to 128 characters.');
  }
  return value;
}

export function validateAccountType(value) {
  if (value == null || value === '') return 'registered';
  if (value !== 'registered' && value !== 'guest') {
    throw new HttpError(400, 'INVALID_ACCOUNT_TYPE', 'Account type must be registered or guest.');
  }
  return value;
}

export function validateProfile(payload = {}, { requireEmail = false } = {}) {
  const fullName = text(payload.fullName, 'Full name', { required: true, maxLength: 120 });
  return {
    fullName,
    email: validateEmail(payload.email, { required: requireEmail }),
    phoneNumber: validatePhoneNumber(payload.phoneNumber),
    barangay: text(payload.barangay, 'Barangay', { maxLength: 120 }),
    municipality: text(payload.municipality, 'Municipality', { maxLength: 120 }),
  };
}

export function validateOptionalText(value, field, maxLength = 160) {
  return text(value, field, { maxLength });
}

export function validateCoordinates(latitude, longitude) {
  const hasLatitude = latitude !== undefined && latitude !== null && latitude !== '';
  const hasLongitude = longitude !== undefined && longitude !== null && longitude !== '';
  if (!hasLatitude && !hasLongitude) return { latitude: null, longitude: null };
  if (!hasLatitude || !hasLongitude) throw new HttpError(400, 'INVALID_LOCATION', 'Both GPS latitude and longitude are required together.');

  const parsedLatitude = Number(latitude);
  const parsedLongitude = Number(longitude);
  if (!Number.isFinite(parsedLatitude) || !Number.isFinite(parsedLongitude) || parsedLatitude < -90 || parsedLatitude > 90 || parsedLongitude < -180 || parsedLongitude > 180) {
    throw new HttpError(400, 'INVALID_LOCATION', 'GPS coordinates are invalid.');
  }
  return { latitude: parsedLatitude, longitude: parsedLongitude };
}

export function validateCapturedAt(value, { required = true } = {}) {
  if (!value && !required) return null;
  const date = new Date(value);
  if (!value || Number.isNaN(date.valueOf())) throw new HttpError(400, 'INVALID_CAPTURE_TIME', 'Capture time must be a valid ISO date.');
  return date.toISOString();
}
