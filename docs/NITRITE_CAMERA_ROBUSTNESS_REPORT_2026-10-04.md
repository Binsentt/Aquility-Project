# Nitrite real-camera robustness evaluation — 2026-10-04

- Source set: existing Davao real-photo set (90 image records), reprocessed through the current production analysis engine. The matcher received only the measured Nitrite ROI RGB and client references.
- Usable Nitrite ROIs: 86; registration / ROI failures: 4 (3 `NITRITE_ROI_INVALID`, 1 `PH_ROI_INVALID`, which prevented strip registration).
- Matcher outputs: 25 reference-color estimates accepted; 61 rejected among usable Nitrite ROIs. Including the 4 no-ROI failures, 65 of 90 records are unavailable/rejected.
- Accepted reference classes: 0 ppm=24, 1 ppm=1.
- Rejection reasons: OUTSIDE_COMPOSITE_ACCEPTANCE_THRESHOLD=33, OUTSIDE_REFERENCE_COLOR_FAMILY=21, AMBIGUOUS_RUNNER_UP_MARGIN=7, NITRITE_ROI_INVALID=3, PH_ROI_INVALID=1. The 61 composite matcher rejections exclude the four records without a usable Nitrite ROI.
- Matching: unique inclusive client RGB interval first; otherwise equal-weight mean normalized by median pairwise reference separation across CIEDE2000, RGB Euclidean, and normalized chromatic RGB. Distance limit 1.5; minimum runner-up score margin 0.2; each component must also stay within twice the largest pairwise configured-reference separation.
- These photos have no known Nitrite concentration labels. These counts describe matcher operation only; they are not Nitrite accuracy, sensitivity, specificity, or laboratory validation.
- Per-image ROI, closest/runner-up references, distances, margin, decision, display value, and status are in [NITRITE_CAMERA_ROBUSTNESS_2026-10-04.csv](./NITRITE_CAMERA_ROBUSTNESS_2026-10-04.csv).
