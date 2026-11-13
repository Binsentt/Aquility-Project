# Client workbook pH calibration evidence

## Source and label provenance

The source is `App_Calibrate (1).xlsx`, sheet `Results_pH1_20min`, SHA-256 `ACAF8F7B09616199F75AFD71A3323D9BC5842689F02639808C7E6B8E78FE5B4F`. Its column A pH group labels are paired with RGB values in columns B:D. The sheet provides eight RGB observations each for pH 1–8 and ten RGB observations under one grouped pH 9–14 label. The Nitrite RGB values in columns J:L have no ppm label.

The measurements are client-supplied calibration evidence. The workbook does not identify a capture device, camera settings, lighting controls, sample preparation protocol, replicate relationships, or independent lab report. The data is integrated as provisional color references; this does not establish laboratory accuracy or camera-to-camera transfer.

The machine-readable extraction is `backend/database/calibration_sources/app-calibrate-1-extracted.json`. The original workbook is retained beside it. Production reference samples and confidence thresholds are in `backend/database/colorAnalysisCalibration.json`.

## pH matching behavior

The scanner continues to use the existing official-time continuous pH model first, followed by the existing client RGB range matcher. Only when neither accepts a color does it try the workbook references. Workbook matching measures nearest-sample CIEDE2000 distance in CIE Lab D65 and requires the measured RGB to fall inside that class's observed per-channel range (rounded outward to integer RGB), its class-specific maximum distance, and its class-specific runner-up margin. A color outside the empirical workbook support stays unmatched. Existing image-quality checks remain in force.

The RGB envelope, distance, and margin limits were selected per predicted class from leave-one-observation-out matching on this same workbook, maximizing accepted observations while accepting no observed wrong labels in that data. The descriptive result is 65 of 74 nearest labels correct; 40 correctly labeled observations pass all configured gates and zero wrong-labeled workbook observations pass. Because the limits were selected using the same workbook and there is no independent camera or lab validation set, these counts are not an accuracy estimate.

The pH 9–14 data remains one grouped reference. It can only display `9-14`; it has no numeric pH and never maps to a specific value from 9 through 14. All ten grouped workbook RGB observations are below the current minimum saturation threshold, so the existing image-quality guard rejects those observed colors in the analysis engine. The matcher and Result/History/Map/PDF presentation path preserve a grouped display if a future accepted observation clears the unchanged quality and match-confidence checks.

## Nitrite handling

The workbook's ten Nitrite RGB observations are retained with `label: null` and `ppm: null` for provenance only. They are not added to active Nitrite references and cannot produce a Nitrite concentration. Existing Nitrite matching, confidence thresholds, and values are unchanged.

## Verification scope

Automated tests cover the workbook matcher, the unchanged official-time precedence, pixel-to-pH-1 analysis, saved record serialization, Result/History display, map markers, and PDF text. The pixel-to-result fixture is synthetic. It verifies code propagation only; it is not a physical-device or chemistry validation test.
