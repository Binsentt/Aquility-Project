# Client-confirmed Nitrite reference feature space — 2026-10-06

## Provenance and scope

The client confirms that the four Nitrite ranges came from tested reference samples in a color test, ordered left-to-right as `0`, `0.5`, `1`, and `>1 ppm`. The active RGB intervals in `backend/database/colorAnalysisCalibration.json` are retained verbatim. Their source and order are now recorded as `CLIENT_CONFIRMED_TESTED_REFERENCE_SAMPLE_COLOR_TEST` and `left-to-right`.

The pasted request contains the confirmation and ranges, but no original reference-color-test image file was present in the workspace or attachment directory. Therefore the feature values below are calculated from each supplied range's channel midpoints; they are not fresh ROI readings from the original image. The six SB-01 phone captures and the 90-photo client set have no independently verified Nitrite concentration labels. They are used only to evaluate matcher behavior and repeatability, never as labeled training data.

## Centroid features

RGB centroid is the per-channel midpoint of the supplied interval. Lab is CIE Lab D65. HSV uses the RGB centroid. Normalized RGB is `(R,G,B)/(R+G+B)`. Relative luminance `Y` is the standard linearized sRGB luminance. `C*ab = sqrt(a*²+b*²)`. Channel contrasts are `R-G` and `R-B`.

| Label | Centroid RGB | Lab L*, a*, b* | C*ab | HSV H°, S, V | Normalized RGB | Y | R-G | R-B |
| --- | --- | --- | ---: | --- | --- | ---: | ---: | ---: |
| 0 ppm | 183, 172, 180 | 71.465, 5.392, -2.677 | 6.020 | 316.364, 0.0601, 0.7176 | 0.342056, 0.321495, 0.336449 | 0.428676 | 11 | 3 |
| 0.5 ppm | 190, 172, 187.5 | 72.270, 9.252, -5.550 | 10.789 | 308.333, 0.0947, 0.7451 | 0.345769, 0.313012, 0.341219 | 0.440615 | 18 | 2.5 |
| 1 ppm | 202.5, 183, 182.5 | 76.003, 6.848, 2.779 | 7.391 | 1.500, 0.0988, 0.7941 | 0.356514, 0.322183, 0.321303 | 0.498915 | 19.5 | 20 |
| >1 ppm | 197, 179, 195 | 74.857, 9.279, -5.767 | 10.925 | 306.667, 0.0914, 0.7725 | 0.345009, 0.313485, 0.341506 | 0.480506 | 18 | 2 |

## Pairwise reference separation

Hue difference is circular. `ΔS`, `ΔV`, and `ΔY` are absolute differences; `Δ(R-G)` and `Δ(R-B)` are absolute differences between the class channel contrasts. The listed RGB/luminance features describe reference centroids, not phone-camera response.

| Pair | ΔE00 | RGB Euclidean | Lab a*b* | Normalized RGB | Hue ° | ΔS | ΔV | ΔY | Δ(R-G) | Δ(R-B) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 vs 0.5 | 4.271 | 10.259 | 4.813 | 0.010417 | 8.030 | 0.034628 | 0.027451 | 0.011939 | 7 | 0.5 |
| 0 vs 1 | 5.883 | 22.528 | 5.647 | 0.020950 | 45.136 | 0.038656 | 0.076471 | 0.070239 | 8.5 | 17 |
| 0 vs >1 | 4.999 | 21.679 | 4.966 | 0.009923 | 9.697 | 0.031261 | 0.054902 | 0.051830 | 7 | 1 |
| 0.5 vs 1 | 7.428 | 17.385 | 8.669 | 0.024418 | 53.167 | 0.004029 | 0.049020 | 0.058300 | 1.5 | 17.5 |
| 0.5 vs >1 | **1.927** | 12.420 | **0.218** | **0.000940** | **1.667** | **0.003366** | 0.027451 | 0.039891 | **0** | 0.5 |
| 1 vs >1 | 7.098 | 14.230 | 8.885 | 0.024823 | 54.833 | 0.007395 | 0.021569 | 0.018409 | 1.5 | 18 |

The 0.5 and >1 ppm centroids are nearly coincident in Lab chroma, normalized RGB, hue, saturation, and the `R-G`/`R-B` contrasts. In these supplied ranges, their separation depends mostly on absolute brightness/value and small residual channel differences. Removing brightness with pure chromaticity or hue-only normalization would erase most of the evidence separating those two classes.

The four exact three-channel RGB boxes are the strongest available class evidence for pixels in the reference-photo domain. For colors outside those exact boxes, the current production method combines CIEDE2000, RGB Euclidean distance, and normalized chromatic RGB, then applies distance, runner-up-margin, and reference-family guards. This retains four discrete labels and avoids interpolation. HSV H/S/V remain diagnostics.

## Camera-domain transform assessment

No common illumination-aware transform is supported by the available labeled data:

- The supplied ranges identify classes in the tested-reference photo, but the photo pixels and any neutral patch in that photo are not available here for independent measurement.
- No verified same-sample RGB pair exists between that reference photo and captures from the target phone. Without such pairs or a known neutral target in both domains, a gain/offset, affine brightness mapping, or reference-to-phone Lab transform cannot be estimated from these observations.
- The six SB-01 phone scans have unknown Nitrite concentrations. They cannot be assigned training labels from their existing matcher outputs.
- Their nearly stable surrounding background (recorded in the 2026-10-05 SB-01 audit) does not supply a reference-photo neutral value and does not establish how the reagent colors should transform.
- Pure chromaticity/hue normalization would nearly collapse 0.5 and >1 ppm. Keeping a brightness term would preserve the reference separation, but there is no labeled phone-domain evidence to set its correction or acceptance region.

**Decision:** retain the existing matcher and rejection guards. No illumination transform or wider acceptance region is introduced. A valid, color-quality-acceptable ROI that fails strict matching now carries the closest supported reference in a separate low-confidence field; its numeric Nitrite value remains null and its status remains `Unavailable`. Invalid or low-quality ROIs remain `No reference match`. The tested-reference confirmation improves label provenance, but does not demonstrate improved real-camera Nitrite matching or analytical accuracy.

## Result presentation and validation boundary

Accepted reference matches continue to use the existing strict matcher and status rules. A non-accepted but valid ROI displays `Closest reference: <class> ppm (low confidence)` and the note that its color was outside the confirmed reference-match range. The nearest class is stored under `closestReferenceEstimate`; `nitrite.value`, `displayValue`, `quantitativeAvailable`, and `classificationStatus` do not promote that class to an accepted result. Result, History, PDF, and Map use the same low-confidence display and `Unavailable` status.

Real-phone µPAD Nitrite accuracy has not been established with labeled phone-camera samples. Non-accepted nearest-reference outputs are shown only as low-confidence reference estimates.

## Six physical SB-01 scans replay

These diagnostics are replayed from the exact six saved photos through the current production engine. Normalized RGB below is a descriptive feature (`RGB / channel sum`), not an adopted correction. Best class and score are nearest-reference diagnostics only; no Nitrite ground truth is available. One pair of records has identical image bytes, so six records represent five distinct photographs.

| Image ID prefix | ROI RGB | Normalized RGB | Best / runner-up | Best / runner-up score | Margin | Decision |
| --- | --- | --- | --- | --- | ---: | --- |
| 10550052 | 170, 158, 138 | 0.364807, 0.339056, 0.296137 | 1 / 0 | 2.794 / 2.940 | 0.146 | Reject: `OUTSIDE_REFERENCE_COLOR_FAMILY` |
| 2517d183 | 180, 169, 169 | 0.347490, 0.326255, 0.326255 | 0 / 1 | 0.761 / 1.199 | 0.438 | Accepted as 0 ppm by existing matcher; true class unknown |
| 42a4b9d0 | 176, 168, 161 | 0.348515, 0.332673, 0.318812 | 0 / 1 | 1.417 / 1.588 | 0.171 | Reject: `AMBIGUOUS_RUNNER_UP_MARGIN` |
| 468b8147 | 168, 154, 154 | 0.352941, 0.323529, 0.323529 | 0 / 1 | 1.502 / 1.761 | 0.259 | Reject: `OUTSIDE_COMPOSITE_ACCEPTANCE_THRESHOLD` |
| 52ddfc65 | 176, 164, 155 | 0.355556, 0.331313, 0.313131 | 1 / 0 | 1.683 / 1.738 | 0.055 | Reject: `OUTSIDE_COMPOSITE_ACCEPTANCE_THRESHOLD` |
| 5ce7323a | 168, 154, 154 | 0.352941, 0.323529, 0.323529 | 0 / 1 | 1.502 / 1.761 | 0.259 | Reject: `OUTSIDE_COMPOSITE_ACCEPTANCE_THRESHOLD`; byte-identical to 468b8147 |

## Ninety-photo client set replay

All 90 images in the six client folders were replayed through the active production engine; the separate root contact sheet was excluded. Counts reproduce the prior run because the matcher is unchanged.

- Usable Nitrite ROIs: **86/90**.
- Accepted: **25**; rejected among usable ROIs: **61**.
- Accepted outputs: **0 ppm: 24; 0.5 ppm: 0; 1 ppm: 1; >1 ppm: 0**.
- Rejection/registration reasons: `OUTSIDE_COMPOSITE_ACCEPTANCE_THRESHOLD`: 33; `OUTSIDE_REFERENCE_COLOR_FAMILY`: 21; `AMBIGUOUS_RUNNER_UP_MARGIN`: 7; `NITRITE_ROI_INVALID`: 3; `PH_ROI_INVALID`: 1.
- These client-folder images have no independently verified Nitrite concentration labels. The counts measure matcher behavior, not accuracy.

## Release decision

No camera-domain matching improvement can be shown from the available evidence, so this task does not meet the user's conditional commit/push/deploy criteria. No production classification behavior, pH behavior, status mapping, ROI geometry, API propagation, or mobile code was changed. The reference-source metadata and this evidence report do not establish real-phone chemical accuracy.
