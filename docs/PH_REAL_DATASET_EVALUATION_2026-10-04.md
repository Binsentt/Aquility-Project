# Historical real-image pH evaluation — 2026-10-04

> **Superseded:** after this evaluation was written, the client confirmed the class-to-laboratory-pH mapping in the 2026-10-04 task message. See [the verified evaluation](PH_VERIFIED_REAL_CALIBRATION_EVALUATION_2026-10-04.md) and [the rebuilt dataset](PH_VERIFIED_REAL_DATASET_2026-10-04.csv). The provisional labels and random-image split below are historical and must not be used for a production decision.

## Decision

No continuous pH estimator was added to production. The available target values are not linked to a confirmed sample collection record for the 9/30 image groups, and the exploratory model is sensitive to reaction time. The current evidence does not support using its predictions as client results.

The per-image measurements and explicitly provisional fold predictions are in [PH_REAL_DATASET_EVALUATION_2026-10-04.csv](PH_REAL_DATASET_EVALUATION_2026-10-04.csv). `HOLDOUT_DIAGNOSTIC_ONLY_NOT_APPROVED` marks every row; these predictions are not Result-screen values.

## Image and label provenance

- The 9/30 dataset contains 90 photos; 86 registered through the production ROI path and 4 did not register.
- The client task note supplies the pH targets Pawikan/SA = 8.21, Fish Farm/SB = 8.16, and Well/A = 7.22.
- `backend/services/sampleSites.js` supports the historical aliases AA → SA/Pawikan and C → SB/Fish Farm, while A maps to Well. This verifies site identity only.
- No lab report, collection/sample ID, or record was found that ties those three measurements to the exact 9/30 captures. The CSV therefore marks all three mappings as provisional and `sample_collection_link` as unconfirmed. No row is approved for calibration.
- No real-image Nitrite concentration labels were found. Nitrite ROI colors are recorded in the CSV, but these images cannot establish Nitrite lab accuracy.
- Current production matching was also run on every photo. It accepted **0/90 pH** results (85 registered colors outside the configured match threshold, 1 registered image with insufficient quality, 4 registration failures) and **0/90 Nitrite** results (86 registered colors outside reference space, 4 registration failures). Per-image Nitrite RGB and rejection diagnostics are in [NITRITE_REAL_DATASET_EVALUATION_2026-10-04.csv](NITRITE_REAL_DATASET_EVALUATION_2026-10-04.csv). Among the 86 measured Nitrite ROIs, the nearest reference was 0 ppm for 52 and 1 ppm for 34, but all were rejected; nearest-reference labels are not reported as measured concentrations.

## Diagnostic model evaluation

The exploratory estimator was ordinary least-squares regression over production-measured CIE Lab ROI features. It was evaluated offline only; production calibration files and runtime pH behavior were not changed.

Random five-fold image holdout over the 86 registered photos produced MAE **0.3174**, RMSE **0.3747**, mean bias **+0.0013**, and absolute-error range **0.0042–1.1787 pH**. This split keeps images from each site/reaction-time folder in both training and holdout, so it is a diagnostic estimate, not an independent collection holdout.

Opposite-reaction-time holdout was materially worse and asymmetric:

| Training captures | Holdout captures | MAE | RMSE | Bias |
|---|---:|---:|---:|---:|
| 1 min (41 images) | 20 min (45 images) | 0.4215 | 0.4528 | −0.0086 |
| 20 min (45 images) | 1 min (41 images) | 0.7334 | 0.7814 | +0.7059 |

Per-site absolute error for the same temporal holdout was:

| Site target (provisional) | 1 min → 20 min MAE | 20 min → 1 min MAE |
|---|---:|---:|
| A / Well, 7.22 | 0.6193 | 0.7695 |
| AA / Pawikan, 8.21 | 0.3271 | 0.7180 |
| C / Fish Farm, 8.16 | 0.3181 | 0.7063 |

These errors and the missing collection linkage prevent a defensible production pH result. The supplied targets cover only the provisional interval 7.22–8.21; no broader pH range is validated.

## Nitrite boundary behavior

Client-supplied status thresholds are implemented centrally for an accepted color-matched Nitrite measurement: `<0.5 ppm` → Safe, `0.5..<1 ppm` → Warning, and `>=1 ppm` → Dangerous. A qualified `>1 ppm` result remains displayed as `>1 ppm` and is classified Dangerous without assigning an exact concentration. These are status-boundary tests, not evidence of Nitrite laboratory accuracy on the 9/30 samples.

## Acceptance state

- Real pH visible in Parameters: **FAIL / not implemented**
- Real Nitrite value proven against a labeled client sample: **FAIL / no labeled real sample found**
- Real client photo produces an accepted pH or Nitrite result with current calibration: **FAIL / 0 of 90 accepted**
- Result, History, PDF, Map status propagation: covered by code-level integration tests; no physical-device test performed
- pH range scientifically validated: **none**; provisional target notes span 7.22–8.21 only
- Hardcoded site/class/GPS/filename-to-chemistry lookup: **not added**
