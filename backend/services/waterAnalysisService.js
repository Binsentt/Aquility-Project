import { HttpError } from '../middleware/errorHandler.js';
import { serializeWaterTest } from '../utils/waterTestSerializer.js';
import { validateCapturedAt, validateCoordinates, validateOptionalText } from '../utils/validation.js';
import { readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';

function imageExtension(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.subarray(0, 4).equals(Buffer.from('RIFF')) && buffer.subarray(8, 12).equals(Buffer.from('WEBP'))) return 'webp';
  return null;
}

async function validateStoredImage(file) {
  if (!file.path) return file;
  const signature = (await readFile(file.path)).subarray(0, 12);
  const extension = imageExtension(signature);
  if (!extension) throw new HttpError(400, 'INVALID_IMAGE', 'The water-test upload must be a JPEG, PNG, or WebP image.');
  const filename = `${file.filename.replace(/\.upload$/, '')}.${extension}`;
  const path = join(dirname(file.path), filename);
  await rename(file.path, path);
  return { ...file, filename, path };
}

async function removeUpload(file) {
  if (!file?.path) return;
  await unlink(file.path).catch(() => undefined);
}

export function createWaterAnalysisService({ colorAnalysisEngine, waterTestModel, userModel, authTokenService = null }) {
  return {
    async analyze({ file, metadata, authenticatedUserId }) {
      if (!file?.filename) {
        throw new HttpError(400, 'IMAGE_REQUIRED', 'A captured water-test image is required.');
      }
      let storedFile = file;
      try {
        if (!authenticatedUserId) {
          throw new HttpError(400, 'USER_REQUIRED', 'A user ID is required for a water test.');
        }
        if (metadata?.userId && metadata.userId !== authenticatedUserId) {
          throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this resource.');
        }
        if (userModel && !(await userModel.findById(authenticatedUserId))) {
          throw new HttpError(401, 'TOKEN_INVALID', 'Your session is no longer valid.');
        }

        const { latitude, longitude } = validateCoordinates(metadata?.gpsLatitude, metadata?.gpsLongitude);
        const capturedAt = validateCapturedAt(metadata?.capturedAt);
        const barangay = validateOptionalText(metadata?.barangay, 'Barangay', 120);
        const municipality = validateOptionalText(metadata?.municipality, 'Municipality', 120);
        storedFile = await validateStoredImage(file);
        const measurements = await colorAnalysisEngine.analyze({ imagePath: `/uploads/${storedFile.filename}` });
        const created = await waterTestModel.create({
          userId: authenticatedUserId,
          imagePath: `/uploads/${storedFile.filename}`,
          latitude,
          longitude,
          barangay,
          municipality,
          capturedAt,
          estimatedPH: measurements.pH,
          phStatus: measurements.phStatus,
          estimatedNitrate: measurements.nitrate,
          nitrateStatus: measurements.nitrateStatus,
          overallStatus: measurements.overallStatus,
          remarks: measurements.remarks,
        });

        return serializeWaterTest(created, authTokenService);
      } catch (error) {
        await removeUpload(storedFile);
        if (storedFile.path !== file.path) await removeUpload(file);
        throw error;
      }
    },
  };
}
