import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { HttpError } from '../middleware/errorHandler.js';
import { assessColorQuality, extractRoiStatistics, matchNitriteClientColor, matchPHClientColor, rgbToHsv, rgbToLab } from '../utils/colorAnalysis.js';
import { estimatePHFromColor } from '../utils/phColorModel.js';
import { classifyMeasurements, classifyNitriteStatus, MEASUREMENT_STATUS } from './measurementClassification.js';
import { buildUPadDiagnosticOverlaySvg, createUPadDiagnosticOverlay, detectUPadRegistration } from './upadRegistration.js';

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');

function formatRgb(rgb) {
  return Array.isArray(rgb) && rgb.length === 3 && rgb.every((channel) => Number.isFinite(Number(channel)))
    ? rgb.map((channel) => Math.round(Number(channel))).join(', ')
    : 'unavailable';
}

function formatNitriteReference(reference) {
  if (!reference) return null;
  return reference.displayValue
    || (reference.qualifier === '>' ? `>${reference.lowerBound} ppm` : `${reference.value} ppm`);
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
      const continuousPH = estimatePHFromColor(phStats.measuredRGB, calibration.pH?.continuousModel);
      const clientColorMatch = matchPHClientColor(
        phStats.measuredRGB,
        calibration.pH?.clientRgbRanges,
      );
      const phProfile = clientColorMatch.reference
        ? clientColorMatch.candidates.find(({ reference }) => reference === clientColorMatch.reference)
        : null;
      const phReferenceLab = phProfile ? rgbToLab(phProfile.centroidRGB) : null;
      const phDeltaE00 = phProfile?.deltaE00 ?? clientColorMatch.diagnostics.bestDistance;
      const phMatch = clientColorMatch.accepted ? {
        reference: {
          ...clientColorMatch.reference,
          exactValue: clientColorMatch.reference.value,
          lab: phReferenceLab,
          source: 'client-rgb-range',
        },
        deltaE00: phDeltaE00,
      } : null;
      const continuousModelAccepted = Boolean(phQuality.reliable && continuousPH.accepted);
      const phReliable = Boolean(phQuality.reliable && (continuousModelAccepted || clientColorMatch.accepted));
      const phValue = !phReliable
        ? null
        : continuousModelAccepted
          ? continuousPH.value
          : phMatch.reference.value;
      const directClientRgbMatch = phReliable && clientColorMatch.matchMethod === 'RAW_RGB_INTERVAL';
      const phReliabilityStatus = !phQuality.reliable
        ? 'IMAGE_QUALITY_INSUFFICIENT'
        : continuousModelAccepted
          ? 'OFFICIAL_TIME_CONTINUOUS_COLOR_MODEL'
          : directClientRgbMatch
          ? 'CLIENT_RGB_RANGE_MATCH'
          : clientColorMatch.accepted
            ? 'CLIENT_CIEDE2000_DISTANCE_MATCH'
            : continuousPH.status === 'OUTSIDE_CALIBRATED_COLOR_DOMAIN'
              ? 'COLOR_OUTSIDE_CALIBRATED_DOMAIN'
              : clientColorMatch.matchState === 'AMBIGUOUS'
                ? 'AMBIGUOUS_REFERENCE_MATCH'
                : 'COLOR_MATCH_OUTSIDE_THRESHOLD';
      const nitriteHsv = rgbToHsv(nitriteStats.measuredRGB);
      const nitriteEstimate = matchNitriteClientColor(
        nitriteStats.measuredRGB,
        calibration.nitrite?.references,
        calibration.nitrite?.matching,
      );
      const nitriteReferenceMatched = nitriteEstimate.accepted;
      const nitriteColorReliable = nitriteQuality.reliable || nitriteReferenceMatched;
      const hasClosestNitriteReference = nitriteColorReliable && Boolean(nitriteEstimate.closestReference);
      const closestReferenceDisplay = hasClosestNitriteReference
        ? formatNitriteReference(nitriteEstimate.closestReference)
        : null;
      const closestReferenceEstimate = hasClosestNitriteReference ? {
        label: nitriteEstimate.closestReference.label,
        value: nitriteEstimate.closestReference.value,
        displayValue: closestReferenceDisplay,
        qualifier: nitriteEstimate.closestReference.qualifier ?? null,
        lowerBound: nitriteEstimate.closestReference.lowerBound ?? null,
      } : null;
      debugLogger?.('parameter-match-diagnostics', {
        pH: {
          ...clientColorMatch.diagnostics,
          continuousModel: {
            status: continuousPH.status,
            rawValue: continuousPH.rawValue,
            value: continuousPH.value,
            clamped: continuousPH.clamped,
            lab: continuousPH.lab,
            modelVersion: continuousPH.modelVersion,
          },
        },
        nitrite: nitriteEstimate.diagnostics,
      });
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
        pH: phValue,
        nitrite: nitriteColorReliable ? nitriteEstimate.value : null,
        thresholds: calibration.thresholds || null,
      });
      const roiLocalizationStatus = registration ? 'Registered µPAD template' : 'Configured pad ROIs';
      const phStatus = phReliable
        ? 'Estimated'
        : !phQuality.reliable ? 'IMAGE_QUALITY_INSUFFICIENT' : 'PH_MEASUREMENT_UNRELIABLE';
      const nitriteQuantitativeAvailable = nitriteColorReliable && nitriteReferenceMatched;
      const nitriteReferenceConfidence = nitriteQuantitativeAvailable
        ? 'ACCEPTED'
        : hasClosestNitriteReference ? 'LOW' : 'UNAVAILABLE';
      const lowConfidenceDisplay = nitriteReferenceConfidence === 'LOW'
        ? `Closest reference: ${closestReferenceDisplay} (low confidence)`
        : null;
      const lowConfidenceNote = nitriteReferenceConfidence === 'LOW'
        ? `Nitrite is closest to the ${closestReferenceDisplay} reference, but the color was outside the confirmed reference-match range.`
        : null;
      const nitriteClassificationStatus = nitriteQuantitativeAvailable
        ? classifyNitriteStatus({
          value: nitriteEstimate.value,
          qualifier: nitriteEstimate.qualifier,
          lowerBound: nitriteEstimate.lowerBound,
        })
        : null;
      const nitriteStatus = nitriteReferenceConfidence === 'LOW'
        ? 'Unavailable'
        : !nitriteColorReliable
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
        : `pH ROI RGB ${formatRgb(phStats.measuredRGB)}: no reliable calibrated color estimate (${phReliabilityStatus}).`;
      const nitriteRemarks = nitriteQuantitativeAvailable
        ? ''
        : lowConfidenceNote
          || `Nitrite ROI RGB ${formatRgb(nitriteStats.measuredRGB)}: no configured reference match (${nitriteEstimate.matchState}).`;

      return {
        pH: {
          value: phValue,
          exactValue: phReliable && !continuousModelAccepted ? phMatch.reference.value : null,
          unit: 'pH',
          status: phStatus,
          measuredRGB: phStats.measuredRGB,
          measuredLab,
          matchedReference: phReliable && !continuousModelAccepted
            ? { label: phMatch.reference.label, lab: phMatch.reference.lab, source: phMatch.reference.source || 'client-lab-reference' }
            : null,
          matchMethod: continuousModelAccepted
            ? 'official-time-continuous-lab-ridge-quadratic'
            : directClientRgbMatch ? 'direct-client-rgb-range' : 'ciede2000-centroid-distance',
          deltaE00: continuousModelAccepted ? null : phDeltaE00,
          reliabilityStatus: phReliabilityStatus,
          calibrationModel: continuousModelAccepted ? {
            version: continuousPH.modelVersion,
            method: continuousPH.method,
            source: calibration.pH.continuousModel.source,
            supportedPH: calibration.pH.continuousModel.supportedPH,
            rawValue: continuousPH.rawValue,
            clamped: continuousPH.clamped,
          } : null,
          rgbMatch: directClientRgbMatch && !continuousModelAccepted ? {
            status: 'EXACT_IN_RANGE',
            confidence: 1,
            provisional: true,
            referenceRGBRange: clientColorMatch.reference.rgbRange,
          } : null,
          labConsistency: phProfile && !continuousModelAccepted ? {
            method: 'CIEDE2000-against-client-RGB-range-midpoint',
            deltaE00: phDeltaE00,
            referenceRGB: phProfile.centroidRGB,
          } : null,
          roi: roiMetadata(phRoi, phStats, 'pH'),
        },
        nitrite: {
          unit: 'ppm',
          measuredRGB: nitriteStats.measuredRGB,
          hue: nitriteHsv.hue,
          saturation: nitriteHsv.saturation,
          valueChannel: nitriteHsv.value,
          matchState: nitriteEstimate.matchState,
          matchingMethod: nitriteEstimate.matchMethod === 'RAW_RGB_INTERVAL'
            ? 'direct-client-rgb-range'
            : 'composite-reference-distance',
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
          closestReferenceEstimate,
          closestReferenceDisplay,
          referenceConfidence: nitriteReferenceConfidence,
          referenceMatchAccepted: nitriteQuantitativeAvailable,
          referenceMatchReason: nitriteEstimate.diagnostics?.reason ?? nitriteEstimate.matchState,
          lowConfidenceDisplay,
          lowConfidenceNote,
          distance: nitriteEstimate.distance ?? null,
          channelDistances: nitriteEstimate.channelDistances ?? null,
          calibrationInterval: null,
          clamped: false,
          quantitativeAvailable: nitriteQuantitativeAvailable,
          classificationStatus: nitriteClassificationStatus,
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
            estimateUse: 'reference-color-based estimate; laboratory accuracy is not established',
            references: calibration.nitrite.references,
            researchFeature: calibration.nitrite.researchMetadata?.feature,
            quantitativeUse: 'unvalidated',
          },
        },
        phStatus,
        nitriteStatus,
        nitriteClassificationStatus,
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
        remarks: `Separate µPAD sensing areas were localized. Accepted parameter values require a configured reference match. ${pHRemarks} ${nitriteRemarks}`.trim(),
      };
    },
  };
}
