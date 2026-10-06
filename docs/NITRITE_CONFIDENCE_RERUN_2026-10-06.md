# Nitrite reference confidence rerun — 2026-10-06

## Client reference data

Client Nitrite source: `CONFIRMED COLOR TEST`. The production metadata is `CLIENT_CONFIRMED_TESTED_REFERENCE_SAMPLE_COLOR_TEST`; its left-to-right order and exact RGB intervals remain `0`, `0.5`, `1`, and `>1 ppm` as documented in [the calibration feature-space audit](./NITRITE_CONFIRMED_REFERENCE_FEATURE_SPACE_2026-10-06.md).

Real-phone µPAD Nitrite accuracy has not been established with labeled phone-camera samples. Non-accepted nearest-reference outputs are shown only as low-confidence reference estimates.

## Confidence behavior

The strict matcher, thresholds, distances, margin, and reference-family guard are unchanged. Accepted matches retain their discrete value and existing status. A color-quality-valid ROI that fails strict acceptance now displays `Closest reference: <class> ppm (low confidence)`. Its `nitrite.value` and `displayValue` remain null, `quantitativeAvailable` is false, and Nitrite status remains `Unavailable`. Invalid or low-quality, non-accepted ROIs continue to show `No reference match`.

The 0.5 ppm and `>1 ppm` labels remain discrete; there is no interpolation or invented concentration. No pH code, pH calibration, pH category, supported domain, reaction-time rule, or ROI geometry was changed.

## Six saved SB-01 scans

These results replay the six persisted ROI RGB measurements in [`NITRITE_SB01_REPEATABILITY_2026-10-05.csv`](./NITRITE_SB01_REPEATABILITY_2026-10-05.csv) through the unchanged production matcher and the new presentation rule. The RGBs are unlabeled phone captures; nearest references are not Nitrite ground truth.

| ROI RGB | Closest / runner-up | Score / margin | Strict accepted | Nitrite display | Status |
| --- | --- | ---: | --- | --- | --- |
| 168, 154, 154 | 0 / 1 | 1.502 / 0.259 | No | Closest reference: 0 ppm (low confidence) | Unavailable |
| 170, 158, 138 | 1 / 0 | 2.794 / 0.146 | No | Closest reference: 1 ppm (low confidence) | Unavailable |
| 176, 164, 155 | 1 / 0 | 1.683 / 0.055 | No | Closest reference: 1 ppm (low confidence) | Unavailable |
| 168, 154, 154 | 0 / 1 | 1.502 / 0.259 | No | Closest reference: 0 ppm (low confidence) | Unavailable |
| 180, 169, 169 | 0 / 1 | 0.761 / 0.438 | Yes | 0 ppm | Safe |
| 176, 168, 161 | 0 / 1 | 1.417 / 0.171 | No | Closest reference: 0 ppm (low confidence) | Unavailable |

Strict accepted: **1/6**. Closest-reference estimate available: **6/6**. The single accepted result remains 0 ppm / Safe; the other five are low confidence / Unavailable.

## 90-image ROI record replay

The 90 image originals were not present in the local workspace. The full saved ROI RGB set from the existing 90-photo audit CSV was re-scored with the current matcher and color-quality rule; this replay does not re-decode the source photographs. The four real µPAD photos checked into the repository were separately re-run through the full image pipeline and are summarized in [`IMAGE_ANALYSIS.md`](./IMAGE_ANALYSIS.md).

| Outcome | Count |
| --- | ---: |
| Strict accepted | 25 |
| Low-confidence closest reference | 43 |
| Unusable / unavailable | 22 |

The 90 records contain 86 extracted Nitrite ROI RGBs and four registration/ROI failures. Of the extracted colors, 18 non-accepted ROIs fail the color-quality gate; 24 other color-quality-insufficient captures remain accepted because the unchanged strict matcher accepted them. This preserves existing strict decisions. The 22 unavailable outputs consist of those 18 rejected low-quality ROIs and the four ROI failures.

Low-confidence nearest-reference distribution (not accuracy statistics):

- Closest 0 ppm: 16
- Closest 0.5 ppm: 0
- Closest 1 ppm: 27
- Closest >1 ppm: 0

Strict accepted distribution: 24 at 0 ppm, 1 at 1 ppm, none at 0.5 or >1 ppm. None of the 90 phone captures has an independently verified Nitrite concentration label.

Per-image re-scored fields are in [`NITRITE_CONFIDENCE_RERUN_2026-10-06.csv`](./NITRITE_CONFIDENCE_RERUN_2026-10-06.csv): ROI color, quality, nearest and runner-up classes, scores, margin, strict acceptance, display, status, and reason.

## Data propagation and controls

The same low-confidence label and `Unavailable` status are preserved in the upload response, saved analysis JSON, Result mapper, History serializer, PDF, and Map marker. Strict values continue to display the exact configured discrete label, including `>1 ppm`, and only accepted Nitrite values receive Safe / Warning / Dangerous statuses.

Regression coverage includes exact 0 / 0.5 / 1 / >1 reference controls, all six SB-01 RGBs, valid nearest-0 and nearest-1 colors, an ambiguous valid color, an unrelated color, an invalid gray color ROI, pH regression, persistence, Result / History / PDF / Map propagation, and auth/session coverage in the full suite.
