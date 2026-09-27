import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler.js';
import { extractRoiStatistics, interpolateNitriteHue, matchPHReference, rgbToHsv, rgbToLab } from '../utils/colorAnalysis.js';

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');

async function readFixture(name) {
  return JSON.parse(await readFile(join(databaseDir, name), 'utf8'));
}

export function createColorAnalysisEngine({ readJson = readFixture } = {}) {
  let calibrationPromise;

  async function loadCalibration() {
    if (!calibrationPromise) calibrationPromise = readJson('colorAnalysisCalibration.json');
    return calibrationPromise;
  }

  return {
    async analyze({ imagePath }) {
      if (!imagePath) {
        throw new Error('An image path is required for analysis.');
      }

      const calibration = await loadCalibration();
      let decodedImage;
      try {
        decodedImage = await sharp(imagePath)
          .rotate()
          .toColourspace('srgb')
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
      } catch {
        throw new HttpError(400, 'INVALID_IMAGE', 'The uploaded image could not be decoded. Please select a valid JPEG, PNG, or WebP image.');
      }
      const { data, info } = decodedImage;
      const fallbackRoi = calibration.roi.fallback;
      const roiFor = (parameter) => calibration.roi.regions[parameter] || fallbackRoi;
      const phRoi = roiFor('pH');
      const nitriteRoi = roiFor('nitrite');
      const phStats = extractRoiStatistics(data, info.width, info.height, phRoi);
      const nitriteStats = extractRoiStatistics(data, info.width, info.height, nitriteRoi);
      const measuredLab = rgbToLab(phStats.measuredRGB);
      const phMatch = matchPHReference(measuredLab, calibration.pH.references);
      const hue = rgbToHsv(nitriteStats.measuredRGB).hue;
      const nitriteEstimate = interpolateNitriteHue(hue, calibration.nitrite.huePoints, calibration.nitrite.ppmValues);
      const roiMetadata = (region, stats, parameter) => ({
        normalized: region,
        pixels: { ...stats.roiPixels },
        statistic: stats.statistic,
        sampleCount: stats.sampleCount,
        strategy: calibration.roi.regions[parameter] ? 'configured-normalized-roi' : 'center-crop-fallback',
      });

      if (!phMatch) throw new Error('No pH color references are configured.');

      return {
        pH: {
          value: phMatch.reference.value,
          unit: 'pH',
          measuredRGB: phStats.measuredRGB,
          measuredLab,
          matchedReference: { label: phMatch.reference.label, lab: phMatch.reference.lab },
          deltaE00: phMatch.deltaE00,
          roi: roiMetadata(phRoi, phStats, 'pH'),
        },
        nitrite: {
          value: nitriteEstimate.ppm,
          unit: 'ppm',
          measuredRGB: nitriteStats.measuredRGB,
          hue,
          hueUnit: calibration.nitrite.hueUnit,
          calibrationInterval: nitriteEstimate.calibrationInterval,
          interpolationMethod: 'piecewise-linear-clamped',
          clamped: nitriteEstimate.clamped,
          roi: roiMetadata(nitriteRoi, nitriteStats, 'nitrite'),
          calibrationMetadata: {
            version: calibration.version,
            source: calibration.source,
            reaction: calibration.nitrite.reaction,
            hueUnit: calibration.nitrite.hueUnit,
            hueUnitRequiresConfirmation: calibration.nitrite.hueUnitRequiresConfirmation,
            provisional: calibration.nitrite.provisional,
            huePoints: calibration.nitrite.huePoints,
            ppmValues: calibration.nitrite.ppmValues,
          },
        },
        phStatus: 'Unvalidated',
        nitriteStatus: 'Unvalidated',
        overallStatus: 'Unvalidated',
        remarks: 'Color matching and provisional Nitrite interpolation were performed using client-provided references. The physical ROI layout and analytical method require experimental validation; this is not a certified water-safety assessment.',
      };
    },
  };
}
