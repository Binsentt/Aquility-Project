# Official-time real-camera pH calibration — 2026-10-04

## Decision and scope

The official-time captures support a **coarse continuous color-derived pH estimate** for scans inside the measured camera-color domain. The final production analyzer produced a numeric result for **43/45** official images. The other two correctly remained without pH: one pH ROI was too low-saturation, and one image failed µPAD registration.

The estimator does not use class, site, GPS, sample ID/code, filename, or reaction time as a pH predictor. Those values select the official capture protocol, stratify/report validation, or establish ground-truth provenance only. Model input is the registered pH ROI median RGB color.

The production values are limited to the verified laboratory pH support **7.22–8.21**. They are not evidence of 0.05-pH resolution, pH 1–14 accuracy, or transfer to new sites, reagent lots, cameras, or water conditions. The 43 captures inherit only three class-level laboratory labels; no individual-strip laboratory pH values were supplied.

## Official protocol and dataset

| Class | Site | Official read time | Client-confirmed lab pH | Photos |
|---|---|---:|---:|---:|
| SA (folder alias AA / AA-PS) | Pawikan | 1 minute | 8.21 | 15 |
| SB (folder alias C / C-FS) | Fish Farm | 20 minutes | 8.16 | 15 |
| A (folder alias A-W) | Well | 20 minutes | 7.22 | 15 |
| **Total** |  |  |  | **45** |

Aliases were checked against `backend/services/sampleSites.js` (AA→SA, C→SB, A→A). Only the matching official-time folder was included for each class. The other 45 images were excluded from production calibration.

The per-image audit is [PH_OFFICIAL_TIME_DATASET_2026-10-04.csv](PH_OFFICIAL_TIME_DATASET_2026-10-04.csv). It includes the assigned folder-order sample ID, source image, inherited class-level target, registration status/confidence, measured ROI RGB and CIE Lab D65, HSV, chromatic RGB, sample count, image-quality result, nested grouped out-of-fold prediction, and final production-analyzer pH/error.

Sample IDs are chronological ordinals within the source folder. The files do not embed physical strip IDs, so those IDs are inferred and do not prove pairing to the same strip across the excluded reaction-time folders. This does not duplicate images in the official-time folds: each official capture enters once per fold repeat.

### Registration and quality

- Official images: **45/45**.
- Registered by the production analyzer: **44/45**.
- Numeric pH returned by the production analyzer: **43/45**.
- Rejected for pH color quality: `AA-PS 1min (9-30-26)/IMG_20260930_223958_005.jpg` — `LOW_SATURATION`.
- Registration failure: `AA-PS 1min (9-30-26)/IMG_20260930_224037_870.jpg` — `NITRITE_ROI_INVALID`.

All 43 eligible ROI colors fall inside the configured model color bounds. The calibrated Lab D65 bounds use the eligible official-time training ROI minima/maxima with a 2-unit margin: L* 53.388–77.876, a* −11.871–22.028, b* 16.435–33.313. The existing image-quality check still rejects low-saturation/dark/bright samples before returning pH.

## Model and validation

The selected deterministic estimator is standardized degree-2 CIE Lab D65 ridge regression (`alpha = 0.01`) over `L, a, b, L², L·a, L·b, a², a·b, b²`. Runtime transforms use the existing production sRGB-to-Lab converter. Coefficients, feature scaling, Lab bounds, target support, and display precision are in `backend/database/colorAnalysisCalibration.json`; implementation is in `backend/utils/phColorModel.js`.

Candidate families were RGB, CIE Lab, chromatic RGB, and HSV; RGB/Lab quadratic terms and ridge strengths were considered. Nested validation selected Lab quadratic alpha 0.01 in 78 of 215 outer predictions and RGB quadratic alpha 0.001 in 78; close selection counts show that the winning feature family is not uniquely determined by this small dataset. Full-data repeated grouped CV gave Lab quadratic alpha 0.001 and 0.01 nearly identical MAE (0.20290 vs. 0.20297); alpha 0.01 was used for the production fit. This is a coarse model, not an independently established chemical calibration curve.

Validation used five repeats of stratified five-fold grouping by inferred physical sample ID. Candidate/model selection used three repeats of four-fold grouped validation within each outer training split. The classes were used only to balance and report folds. Each outer prediction was made by a fit that excluded that sample group. Predictions were clipped only to the pre-declared verified target support, 7.22–8.21 pH; no class-specific value was used.

| Nested grouped out-of-fold metric | pH units |
|---|---:|
| Predictions | 215 held-out predictions (43 eligible samples × 5 repeats) |
| MAE | **0.2085** |
| RMSE | **0.2821** |
| Mean bias | **−0.0174** |
| Maximum absolute error | **0.6844** |
| Training-fold mean baseline MAE | 0.4379 |
| Training-fold mean baseline RMSE | 0.4598 |

Per-target values below pool the five held-out predictions for each eligible sample. The range is the range of those color-derived OOF predictions.

| Class / lab target | Eligible samples | OOF mean | OOF MAE | OOF RMSE | OOF bias | OOF range |
|---|---:|---:|---:|---:|---:|---:|
| A / 7.22 | 15 | 7.484 | 0.264 | 0.320 | +0.264 | 7.220–7.904 |
| SB / 8.16 | 15 | 7.916 | 0.265 | 0.324 | −0.244 | 7.485–8.210 |
| SA / 8.21 | 13 | 8.130 | 0.080 | 0.155 | −0.080 | 7.618–8.210 |

For a separate transfer diagnostic, leaving out each whole class produced MAE A **0.932**, SB **0.471**, SA **0.090**. The model therefore must stay limited to the represented capture conditions; grouped sample validation does not support transfer to an unseen class/color domain. The 8.16 and 8.21 targets are not separable at 0.05 pH from these images.

The final production analyzer stores full numeric precision and presents one decimal on Result, History, PDF, and Map. It clips in-domain model outputs to the current verified pH support and rejects ROI colors outside the calibrated Lab bounds. The prior narrow client pH 1–4 RGB references remain as a separate color-matching fallback; they do not gate or replace the official-time continuous estimate.

## Production analyzer results and data flow

All 45 official images were run through `createColorAnalysisEngine().analyze({ imagePath })`, which decodes the source JPEG, registers the µPAD, measures its pH ROI, applies the production Lab model, and returns the result consumed by persistence. The complete scan-by-scan values and errors are in the CSV. Numeric results: A **15/15**, SB **15/15**, SA **13/15**.

Three actual accepted images were then submitted through the API route and the real analyzer/service/serializer path. Persistence used the test suite’s in-memory model adapter. Result, History, PDF, and Map displayed the same rounded pH; the map retained the exact persisted numeric value.

| Real scan | Expected lab pH | Raw pH ROI RGB | Analyzer / persisted pH | Parameters | Result = History = PDF = Map |
|---|---:|---|---:|---:|---|
| A-01, Well, 20 min | 7.22 | 186, 178, 142 | 7.39097 | 7.4 | PASS |
| SB-01, Fish Farm, 20 min | 8.16 | 173, 160, 126 | 8.00858 | 8.0 | PASS |
| SA-01, Pawikan, 1 min | 8.21 | 186, 135, 104 | 8.21000 | 8.2 | PASS |

The API anti-hardcode test sends the same exact image pixels while changing sample class/code and GPS; pH remains identical. A second test holds class/code/GPS fixed and changes only ROI pixels; the pH changes. The analysis engine receives only `imagePath`, never class metadata.

## Protocol guidance, Nitrite, and limitations

The scanner now shows `Read/scan after 1 minute` for SA and `Read/scan after 20 minutes` for SB/A after class selection. This is protocol guidance only; the app does not verify elapsed reaction time. The result remains based only on pixels. Users must follow the displayed protocol because 1-minute and 20-minute colors can differ materially.

Nitrite references, thresholds, `>1 ppm` display, and runtime behavior were not changed. These 45 photos have no Nitrite laboratory ground truth, so Nitrite lab validation remains **none**.

The 43 sample-group CV cases are in-domain scans from the same client dataset used to fit the final model. They support useful within-condition color-to-pH estimates but do not establish accuracy for other cameras, strips, lots, water samples, or unrepresented pH values. No individual-strip lab measurements exist to validate within-class variation.
