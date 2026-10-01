import { HttpError } from '../middleware/errorHandler.js';
import { serializeWaterTest } from '../utils/waterTestSerializer.js';
import { validateCapturedAt, validateCoordinates, validateGpsAccuracy, validateOptionalText, validateSampleCode, validateSampleNumber } from '../utils/validation.js';
import { readFile, rename, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { matchSampleSite, sampleSiteForClass } from './sampleSites.js';

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

export function createWaterAnalysisService({ colorAnalysisEngine, waterTestModel, userModel, authTokenService = null, debugLogger = null, sampleSiteMatcher = matchSampleSite }) {
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
        const gpsCapturedAt = validateCapturedAt(metadata?.gpsCapturedAt || metadata?.capturedAt);
        const gpsAccuracyMeters = validateGpsAccuracy(metadata?.gpsAccuracyMeters);
        const barangay = validateOptionalText(metadata?.barangay, 'Barangay', 120);
        const municipality = validateOptionalText(metadata?.municipality, 'Municipality', 120);
        const sampleCode = validateSampleCode(metadata?.sampleCode);
        const sampleNumber = validateSampleNumber(metadata?.sampleNumber);
        const requestedSampleClass = validateOptionalText(metadata?.sampleClass, 'Sample class', 8)
          || (sampleCode ? sampleCode.split('-')[0] : null);
        if (sampleNumber != null && !sampleCode) {
          throw new HttpError(400, 'INVALID_SAMPLE_CODE', 'A sample code is required when a sample number is provided.');
        }
        if (sampleCode && sampleNumber != null) {
          const codeNumber = Number(sampleCode.split('-')[1]);
          if (codeNumber !== sampleNumber) {
            throw new HttpError(400, 'INVALID_SAMPLE_CODE', 'Sample number must match the selected sample code.');
          }
        }
        if (requestedSampleClass && sampleCode && requestedSampleClass !== sampleCode.split('-')[0]) {
          throw new HttpError(400, 'INVALID_SAMPLE_SITE', 'The sample class does not match the selected sample code.');
        }
        const selectedSampleSite = requestedSampleClass ? sampleSiteForClass(requestedSampleClass) : null;
        if (requestedSampleClass && !selectedSampleSite) {
          throw new HttpError(400, 'INVALID_SAMPLE_SITE', 'The sample class must be AA, A, or C.');
        }
        const sampleSite = selectedSampleSite || sampleSiteMatcher(latitude, longitude) || {
          classCode: null,
          siteName: 'Unknown sampling site',
          sourceType: null,
          latitude: null,
          longitude: null,
        };
        const resolvedSampleClass = requestedSampleClass || sampleSite.classCode || null;
        storedFile = await validateStoredImage(file);
        const measurements = await colorAnalysisEngine.analyze({ imagePath: storedFile.path, debugLogger });
        debugLogger?.('analysis-complete', { status: measurements.overallStatus || null });
        debugLogger?.('db-save-start', { userPresent: true });
        const created = await waterTestModel.create({
          userId: authenticatedUserId,
          imagePath: `/uploads/${storedFile.filename}`,
          latitude,
          longitude,
          sampleClass: resolvedSampleClass,
          siteName: sampleSite.siteName === 'Unknown sampling site' ? null : sampleSite.siteName,
          sourceType: sampleSite.sourceType,
          sampleCode,
          sampleNumber,
          barangay,
          municipality,
          capturedAt,
          gpsAccuracyMeters,
          gpsCapturedAt,
          canonicalLatitude: sampleSite.latitude == null ? null : (Number.isFinite(Number(sampleSite.latitude)) ? Number(sampleSite.latitude) : null),
          canonicalLongitude: sampleSite.longitude == null ? null : (Number.isFinite(Number(sampleSite.longitude)) ? Number(sampleSite.longitude) : null),
          estimatedPH: typeof measurements.pH.value === 'number' ? measurements.pH.value : null,
          phStatus: measurements.phStatus,
          estimatedNitrite: measurements.nitrite.value,
          nitriteStatus: measurements.nitriteStatus,
          measuredParametersStatus: measurements.measuredParametersStatus,
          scientificValidationStatus: measurements.scientificValidationStatus,
          labPH: null,
          labNitrite: null,
          analysisData: { pH: measurements.pH, nitrite: measurements.nitrite, roiLocalizationStatus: measurements.roiLocalizationStatus },
          overallStatus: measurements.overallStatus,
          remarks: measurements.remarks,
        });
        debugLogger?.('db-save-complete', { recordCreated: true });

        return serializeWaterTest(created, authTokenService);
      } catch (error) {
        await removeUpload(storedFile);
        if (storedFile.path !== file.path) await removeUpload(file);
        throw error;
      }
    },
  };
}
