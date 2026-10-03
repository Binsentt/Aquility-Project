import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler.js';
import { assessColorQuality, deltaE00, extractRoiStatistics, matchNitriteClientRgbRange, matchPHClientRgbRange, matchPHReference, rgbToHsv, rgbToLab } from '../utils/colorAnalysis.js';
import { classifyMeasurements, MEASUREMENT_STATUS } from './measurementClassification.js';
import { buildUPadDiagnosticOverlaySvg, createUPadDiagnosticOverlay, detectUPadRegistration } from './upadRegistration.js';

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');

function formatRgb(rgb) {
  return Array.isArray(rgb) && rgb.length === 3 && rgb.every((channel) => Number.isFinite(Number(channel)))
    ? rgb.map((channel) => Math.round(Number(channel))).join(', ')
    : 'unavailable';
}

async function readFixture(name) {
  return JSON.parse(await readFile(join(databaseDir, name), 'utf8'));
}

export function createColorAnalysisEngine({ readJson = readFixture, allowDeveloperRoiFixture = false } = {}) {
  let calibrationPromise;

  async function loadCalibration() {
    if (!calibrationPromise) calibrationPromise = readJson('colorAnalysisCalibration.json');
    return calibrationPromise;
  }

  return {
    async analyze({ imagePath, debugLogger = null }) {
      if (!imagePath) {
        throw new Error('An image path is required for analysis.');
      }

      const calibration = await loadCalibration();
      let decodedImage;
      try {
        debugLogger?.('sharp-decode-start');
        decodedImage = await sharp(imagePath)
          .rotate()
          .toColourspace('srgb')
          .removeAlpha()
          .raw()
          .toBuffer({ resolveWithObject: true });
      } catch {
        debugLogger?.('sharp-decode-failed');
        throw new HttpError(422, 'INVALID_STRIP_FORMAT', 'Test strip not detected. Please capture a clear JPEG, PNG, or WebP image of the water-test strip.');
      }
      debugLogger?.('sharp-decode-complete', { width: decodedImage.info.width, height: decodedImage.info.height });
      const { data, info } = decodedImage;
      const configuredRegions = calibration.roi?.regions || {};
      const physicalGeometryApproved = calibration.roi?.productionAllowed === true;
      const developerFixtureAllowed = allowDeveloperRoiFixture && calibration.roi?.fallbackUsage === 'development-tests-only';
      const registrationEnabled = physicalGeometryApproved && calibration.roi?.registration?.enabled === true;
      let registration = null;
      let phRoi = configuredRegions.pH || null;
      let nitriteRoi = configuredRegions.nitrite || null;

      if (registrationEnabled) {
        registration = detectUPadRegistration(data, info.width, info.height, calibration.roi.registration.options || {});
        debugLogger?.('upad-registration', {
          status: registration.status,
          reason: registration.reason || null,
          failureCode: registration.failureCode || null,
          registrationConfidence: registration.registrationConfidence || null,
          diagnostics: registration.diagnostics || null,
          overlay: registration.diagnostics
            ? { ...createUPadDiagnosticOverlay(registration), svg: buildUPadDiagnosticOverlaySvg(registration) }
            : null,
        });
        if (registration.status !== 'REGISTERED') {
          debugLogger?.('strip-registration-failed', {
            width: info.width,
            height: info.height,
            referenceDetected: false,
            roiDetected: { pH: false, nitrite: false },
            registrationStatus: 'STRIP_REGISTRATION_FAILED',
            detectedRegistrationStatus: registration.status,
            reason: registration.failureCode || registration.reason || 'UPAD_NOT_DETECTED',
            diagnostics: registration.diagnostics || null,
          });
          const registrationError = new HttpError(
            422,
            'STRIP_REGISTRATION_FAILED',
            'The square and triangle references and both circular sensing areas could not be detected clearly. Please keep the full µPAD visible and capture a sharp top-view image.',
          );
          registrationError.registrationFailureCode = registration.failureCode || 'REFERENCE_PAIR_INVALID';
          throw registrationError;
        }
        phRoi = registration.pH.roi;
        nitriteRoi = registration.nitrite.roi;
      }
      const validRoi = (roi) => roi
        && ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(roi[key]))
        && roi.x >= 0 && roi.y >= 0 && roi.width > 0 && roi.height > 0
        && roi.x + roi.width <= 1 && roi.y + roi.height <= 1;
      const sameRoi = phRoi && nitriteRoi && ['x', 'y', 'width', 'height'].every((key) => phRoi[key] === nitriteRoi[key]);
      if (!validRoi(phRoi) || !validRoi(nitriteRoi) || sameRoi || (!registrationEnabled && !developerFixtureAllowed)) {
        const registrationFailureCode = !validRoi(phRoi)
          ? 'PH_ROI_INVALID'
          : !validRoi(nitriteRoi)
            ? 'NITRITE_ROI_INVALID'
            : sameRoi
              ? 'REFERENCE_PAIR_INVALID'
              : 'REFERENCE_PAIR_INVALID';
        debugLogger?.('strip-registration-failed', {
          width: info.width,
          height: info.height,
          referenceDetected: false,
          roiDetected: { pH: false, nitrite: false },
          registrationStatus: 'STRIP_REGISTRATION_FAILED',
          reason: registrationFailureCode,
          imageWidth: info.width,
          imageHeight: info.height,
          nitriteRoiValid: validRoi(nitriteRoi),
          phRoiValid: validRoi(phRoi),
        });
        const registrationError = new HttpError(
          422,
          'STRIP_REGISTRATION_FAILED',
          'The square and triangle references and both circular sensing areas could not be detected clearly. Please keep the full µPAD visible and capture a sharp top-view image.',
        );
        registrationError.registrationFailureCode = registrationFailureCode;
        throw registrationError;
      }
      const phStats = extractRoiStatistics(data, info.width, info.height, phRoi);
      const nitriteStats = extractRoiStatistics(data, info.width, info.height, nitriteRoi);
      const phQuality = assessColorQuality(phStats.measuredRGB);
      const nitriteQuality = assessColorQuality(nitriteStats.measuredRGB);
      debugLogger?.('roi-quality', { pH: phQuality, nitrite: nitriteQuality });
      if (!phQuality.reliable && !registration) {
        throw new HttpError(422, 'IMAGE_QUALITY_INSUFFICIENT', 'The sensing areas are too gray, dark, bright, or unclear for a reliable analysis. Please retake the image with the µPAD clearly visible.');
      }
      const measuredLab = rgbToLab(phStats.measuredRGB);
      const maxDeltaE00 = calibration.pH?.maxDeltaE00;
      const phThresholdConfigured = Number.isFinite(maxDeltaE00) && maxDeltaE00 >= 0;
      // A grouped 0-4/10-14 Lab reference is descriptive metadata, not an
      // individual measured pH level. Exact pH 1-4 outputs come only from the
      // separately supplied client RGB ranges; Lab matching accepts numeric
      // exact references only.
      const exactPHReferences = (Array.isArray(calibration.pH?.references) ? calibration.pH.references : [])
        .filter((reference) => Number.isFinite(reference?.exactValue));
      const legacyLabMatch = matchPHReference(measuredLab, exactPHReferences, { maxDeltaE00 });
      const clientRgbMatch = matchPHClientRgbRange(
        phStats.measuredRGB,
        calibration.pH?.clientRgbRanges,
      );
      let phMatch = legacyLabMatch;
      if (clientRgbMatch) {
        const sourceRange = clientRgbMatch.reference.rgbRange;
        const clientReferenceRgb = ['r', 'g', 'b'].map((channel) => {
          const [minimum, maximum] = clientRgbMatch.normalizedRanges[['r', 'g', 'b'].indexOf(channel)];
          return (minimum + maximum) / 2;
        });
        const clientReferenceLab = rgbToLab(clientReferenceRgb);
        const clientDeltaE00 = deltaE00(measuredLab, clientReferenceLab);
        phMatch = {
          reference: {
            label: clientRgbMatch.reference.label,
            value: clientRgbMatch.reference.value,
            exactValue: clientRgbMatch.reference.value,
            lab: clientReferenceLab,
            source: 'client-rgb-range',
            rgbRange: sourceRange,
          },
          deltaE00: clientDeltaE00,
          reliabilityStatus: Number.isFinite(maxDeltaE00)
            ? 'RELIABLE_WITHIN_PROVISIONAL_THRESHOLD'
            : 'THRESHOLD_NOT_CONFIGURED',
          candidates: legacyLabMatch?.candidates || [],
          rgbMatch: clientRgbMatch,
          labConsistency: {
            method: 'CIEDE2000-against-client-RGB-range-midpoint',
            deltaE00: clientDeltaE00,
            referenceRGB: clientReferenceRgb,
          },
        };
      }
      const directClientRgbMatch = Boolean(clientRgbMatch);
      const phReferenceReliable = directClientRgbMatch
        || (phThresholdConfigured && phMatch && phMatch.deltaE00 <= maxDeltaE00);
      const phReliable = Boolean(phQuality.reliable && phReferenceReliable);
      const phReliabilityStatus = !phQuality.reliable
        ? 'IMAGE_QUALITY_INSUFFICIENT'
        : directClientRgbMatch
          ? 'CLIENT_RGB_RANGE_MATCH'
        : !phThresholdConfigured
          ? 'THRESHOLD_NOT_CONFIGURED'
          : !phMatch
            ? 'NO_VALID_REFERENCE_MATCH'
            : phMatch.deltaE00 > maxDeltaE00
              ? 'COLOR_MATCH_OUTSIDE_THRESHOLD'
              : 'RELIABLE_WITHIN_PROVISIONAL_THRESHOLD';
      const nitriteHsv = rgbToHsv(nitriteStats.measuredRGB);
      const nitriteEstimate = matchNitriteClientRgbRange(
        nitriteStats.measuredRGB,
        calibration.nitrite?.references,
      );
      const nitriteReferenceMatched = nitriteEstimate.matchState === 'EXACT_OR_IN_RANGE'
        || nitriteEstimate.matchState === 'ABOVE_1_PPM';
      const nitriteColorReliable = nitriteQuality.reliable || nitriteReferenceMatched;
      debugLogger?.('nitrite-diagnostics', {
        width: info.width,
        height: info.height,
        referenceCoordinates: registration ? {
          square: registration.square.center,
          triangle: registration.triangle.center,
        } : null,
        nitriteRoiPixels: { ...nitriteStats.roiPixels },
        medianRGB: nitriteStats.measuredRGB,
        hue: nitriteHsv.hue,
        saturation: nitriteHsv.saturation,
        value: nitriteHsv.value,
        matchState: nitriteEstimate.matchState,
        closestReference: nitriteEstimate.reference?.value ?? nitriteEstimate.closestReference?.value ?? null,
        distance: nitriteEstimate.distance ?? null,
        clamped: false,
        status: nitriteEstimate.matchState,
      });
      const roiMetadata = (region, stats, zone) => ({
        normalized: region,
        pixels: { ...stats.roiPixels },
        statistic: stats.statistic,
        sampleCount: stats.sampleCount,
        strategy: registration ? 'registered-circle-roi' : 'configured-normalized-roi',
        samplingMask: region.shape || 'rectangle',
        sampleRadiusFraction: region.sampleRadiusFraction ?? null,
        zone,
        detectionConfidence: registration?.[zone]?.confidence ?? null,
        registeredGeometry: registration ? {
          normalized: registration[zone]?.normalized || null,
          registrationConfidence: registration.registrationConfidence,
          source: registration.template.source,
        } : null,
      });

      const classification = classifyMeasurements({
        pH: phReliable ? phMatch.reference.exactValue : null,
        nitrite: nitriteColorReliable ? nitriteEstimate.value : null,
        thresholds: calibration.thresholds || null,
      });
      const roiLocalizationStatus = registration ? 'Registered µPAD template' : 'Configured pad ROIs';
      const phValue = phReliable
        ? (phMatch.reference.exactValue == null ? phMatch.reference.value : phMatch.reference.exactValue)
        : null;
      const phStatus = phReliable
        ? (phMatch.reference.exactValue == null ? 'EstimatedRange' : 'Estimated')
        : !phQuality.reliable ? 'IMAGE_QUALITY_INSUFFICIENT' : 'PH_MEASUREMENT_UNRELIABLE';
      const nitriteQuantitativeAvailable = nitriteColorReliable && nitriteReferenceMatched;
      const nitriteStatus = !nitriteColorReliable
        ? 'NITRITE_IMAGE_QUALITY_INSUFFICIENT'
        : nitriteEstimate.matchState === 'ABOVE_1_PPM'
          ? 'ABOVE_1_PPM'
        : nitriteQuantitativeAvailable
        ? 'Estimated'
        : (nitriteEstimate.matchState === 'AMBIGUOUS'
          ? 'NITRITE_MEASUREMENT_UNRELIABLE'
          : 'NITRITE_OUTSIDE_CALIBRATION_RANGE');
      const pHRemarks = phReliable
        ? ''
        : `pH ROI RGB ${formatRgb(phStats.measuredRGB)}: no reliable reference match (${phReliabilityStatus}).`;
      const nitriteRemarks = nitriteQuantitativeAvailable
        ? ''
        : `Nitrite ROI RGB ${formatRgb(nitriteStats.measuredRGB)}: no configured reference match (${nitriteEstimate.matchState}).`;

      return {
        pH: {
          value: phValue,
          exactValue: phReliable ? phMatch.reference.exactValue : null,
          unit: 'pH',
          status: phStatus,
          measuredRGB: phStats.measuredRGB,
          measuredLab,
          matchedReference: phReliable ? { label: phMatch.reference.label, lab: phMatch.reference.lab, source: phMatch.reference.source || 'client-lab-reference' } : null,
          matchMethod: phReliable && phMatch.rgbMatch ? 'direct-client-rgb-range' : 'ciede2000-lab-reference',
          deltaE00: phMatch?.deltaE00 ?? null,
          reliabilityStatus: phReliabilityStatus,
          rgbMatch: phReliable && phMatch.rgbMatch ? {
            status: phMatch.rgbMatch.status,
            confidence: phMatch.rgbMatch.confidence,
            provisional: phMatch.rgbMatch.provisional,
            referenceRGBRange: phMatch.rgbMatch.reference.rgbRange,
          } : null,
          labConsistency: phMatch?.labConsistency || null,
          roi: roiMetadata(phRoi, phStats, 'pH'),
        },
        nitrite: {
          unit: 'ppm',
          measuredRGB: nitriteStats.measuredRGB,
          hue: nitriteHsv.hue,
          saturation: nitriteHsv.saturation,
          valueChannel: nitriteHsv.value,
          matchState: nitriteEstimate.matchState,
          matchingMethod: 'direct-client-rgb-range',
          matchedReference: nitriteEstimate.reference ? {
            label: nitriteEstimate.reference.label,
            value: nitriteEstimate.reference.value,
            rgbRange: nitriteEstimate.reference.rgbRange,
          } : null,
          closestReference: nitriteEstimate.closestReference ? {
            label: nitriteEstimate.closestReference.label,
            value: nitriteEstimate.closestReference.value,
            rgbRange: nitriteEstimate.closestReference.rgbRange,
          } : null,
          distance: nitriteEstimate.distance ?? null,
          channelDistances: nitriteEstimate.channelDistances ?? null,
          calibrationInterval: null,
          clamped: false,
          quantitativeAvailable: nitriteQuantitativeAvailable,
          status: nitriteStatus,
          measuredColorReliable: nitriteColorReliable,
          value: nitriteQuantitativeAvailable ? nitriteEstimate.value : null,
          displayValue: nitriteQuantitativeAvailable ? nitriteEstimate.displayValue : null,
          qualifier: nitriteQuantitativeAvailable ? nitriteEstimate.qualifier ?? null : null,
          lowerBound: nitriteQuantitativeAvailable ? nitriteEstimate.lowerBound ?? null : null,
          roi: roiMetadata(nitriteRoi, nitriteStats, 'nitrite'),
          calibrationMetadata: {
            version: calibration.version,
            source: calibration.nitrite.source,
            analyte: calibration.nitrite.analyte,
            unit: calibration.nitrite.unit,
            reaction: calibration.nitrite.reaction,
            provisional: calibration.nitrite.provisional,
            matching: calibration.nitrite.matching,
            references: calibration.nitrite.references,
            researchFeature: calibration.nitrite.researchMetadata?.feature,
            quantitativeUse: 'unvalidated',
          },
        },
        phStatus,
        nitriteStatus,
        scanStatus: 'Completed',
        measuredParametersStatus: classification.status,
        scientificValidationStatus: MEASUREMENT_STATUS.SCIENTIFIC_PENDING,
        overallStatus: 'NOT CLASSIFIED',
        roiLocalizationStatus,
        registration: registration ? {
          status: registration.status,
          registrationConfidence: registration.registrationConfidence,
          squareDetected: true,
          triangleDetected: true,
          nitriteZoneDetected: true,
          phZoneDetected: true,
          overlay: { ...createUPadDiagnosticOverlay(registration), svg: buildUPadDiagnosticOverlaySvg(registration) },
        } : null,
        remarks: `Separate µPAD sensing areas were localized. Values are shown only when a configured reference matches. ${pHRemarks} ${nitriteRemarks}`.trim(),
      };
    },
  };
}
