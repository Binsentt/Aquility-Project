# Verified real pH calibration evaluation — 2026-10-04

> **Superseded:** the client later confirmed the official timing (SA 1 minute; SB and A 20 minutes). This earlier decision treated timing as unresolved. Use [the official-time evaluation](PH_OFFICIAL_TIME_CALIBRATION_EVALUATION_2026-10-04.md) and [the official 45-image dataset](PH_OFFICIAL_TIME_DATASET_2026-10-04.csv) for the current implementation and validation.

## Decision

**Do not ship a production pH regression from this dataset yet.** The client-confirmed labels and real camera ROIs show a color-to-label association within the three known classes, but the acceptance evidence is insufficient for an unconditional camera result: the 1-minute and 20-minute camera colors shift substantially, the app does not record reaction time, ordinal image pairing is not verified by strip ID, and the close targets 8.16 and 8.21 are not separable at 0.05 pH resolution. Leave-one-class-out evaluation also fails badly for Well/A. No production or mobile code was changed; no calibration was deployed.

The continuous values below are **offline grouped cross-validation diagnostics only**. They are not Result-screen values or a fitted production calibration.

## Client-confirmed targets and provenance

The client task message dated 2026-10-04 confirms these class-to-laboratory-pH mappings and authorizes them as ground truth:

| Class | Site | Client-confirmed lab pH | Physical µPADs |
|---|---|---:|---:|
| A | Well | 7.22 | 15 |
| SB (folder alias C) | Fish Farm | 8.16 | 15 |
| SA (folder alias AA) | Pawikan | 8.21 | 15 |
| **Total** |  |  | **45** |

Repository identity mapping was checked in backend/services/sampleSites.js: AA → SA, C → SB, A → A. The supplied target is repeated across all 15 same-class strips. No individual µPAD lab value or standalone lab certificate is present in the workspace, so the 45 image-derived records represent 45 physical-strip groups carrying only **three distinct class-level lab targets**.

## Dataset reconstruction and ROI measurements

The 9/30 client image set contains 90 JPEGs in six folders: 15 per class at 1 minute and 15 per class at 20 minutes. The backend production image-analysis/registration path supplied pH ROI RGB, CIE Lab D65 and quality metadata for the dataset.

- Registered: **86/90**.
- Eligible for offline color fitting: **85/90** (one registered image rejected for low-saturation color quality).
- The four failed registrations are:
  - AA-PS 1min (9-30-26)/IMG_20260930_224037_870.jpg
  - C-FS 1min (9-30-26)/IMG_20260930_232457_548.jpg
  - C-FS 1min (9-30-26)/IMG_20260930_232540_255.jpg
  - C-FS 1min (9-30-26)/IMG_20260930_232645_803.jpg
- The registered but quality-excluded image is AA-PS 1min (9-30-26)/IMG_20260930_223958_005.jpg (LOW_SATURATION).
- Eligible ROI photos by class/time: A 15/15; SB 12/15; SA 13/15 at 1 minute; all classes 15/15 at 20 minutes.

The complete 90-row audit, including excluded files, assigned label, inferred sample ID, real ROI RGB/Lab, quality fields, and per-image out-of-fold diagnostic predictions, is [PH_VERIFIED_REAL_DATASET_2026-10-04.csv](PH_VERIFIED_REAL_DATASET_2026-10-04.csv).

### Pairing limitation

No embedded strip ID or image metadata establishes which individual 1-minute photo matches which 20-minute photo. The 45 group IDs (A-01…15, SB-01…15, SA-01…15) are assigned by chronological ordinal within the class/time folders; they are explicitly **inferred, not confirmed**. Forty inferred pairs have eligible ROI readings at both times. Grouped folds keep all rows with the same inferred ID together, preventing the obvious ordinal-pair leakage, but exact physical pairing cannot be guaranteed. A separate leave-one-class-out evaluation avoids all same-class capture overlap and is reported below as a conservative transfer check.

## Offline model and grouped validation method

Predictors are derived only from the measured pH ROI RGB pixels:

- RGB channels;
- CIE Lab D65 L*, a*, b*;
- chromatic R/(R+G+B), G/(R+G+B);
- HSV sin(hue), cos(hue), saturation and value.

No class, site, sample ID/code, GPS, filename, account, or reaction-time feature is given to regression. Class labels are used only as target provenance and to balance/report folds; reaction time is used only to subset 1-minute and 20-minute evaluations. Features for each inferred physical-strip group are averaged before fitting so a strip with two captures does not receive double training weight. Standardized ordinary least-squares models use a negligible numerical diagonal stabilizer (1e-9); no higher-order terms, class lookup or post-fit label forcing are used.

For each evaluation, a deterministic five-fold split uses a SHA-256 seeded, class-stratified ordering. In the combined evaluation, three sample IDs per class fall in each fold. The 1-minute folds are similarly balanced across the available samples, with smaller per-fold counts for classes that have fewer eligible ROIs. Every image with the same inferred sample ID stays in one held-out fold. The table reports sample-level predictions (average of the held-out image predictions for each inferred ID); the CSV also reports individual image OOF predictions. All transforms are fit on each training fold. A fold-trained global-mean model is included as a baseline. Feature selection is exploratory across four simple linear feature families and is not an independent final holdout.

### Grouped five-fold metrics

Metrics are in pH units. “Max absolute error” is the maximum absolute sample-level out-of-fold error. The combined condition averages available per-sample 1-minute and 20-minute features; it is diagnostic only because runtime reaction time is unknown.

| Features | Combined, n=45 | 1 minute | 20 minutes |
|---|---|---|---|
| RGB | MAE 0.191 / RMSE 0.246 / bias 0.002 / max absolute error 0.837 (n=45) | MAE 0.172 / RMSE 0.224 / bias 0.002 / max absolute error 0.658 (n=40) | MAE 0.333 / RMSE 0.368 / bias 0.001 / max absolute error 0.645 (n=45) |
| CIE Lab D65 | MAE 0.191 / RMSE 0.246 / bias 0.002 / max absolute error 0.823 (n=45) | MAE 0.172 / RMSE 0.221 / bias 0.003 / max absolute error 0.643 (n=40) | MAE 0.339 / RMSE 0.371 / bias 0.001 / max absolute error 0.648 (n=45) |
| Chromatic R/sum, G/sum | MAE 0.246 / RMSE 0.301 / bias -0.001 / max absolute error 0.694 (n=45) | MAE 0.184 / RMSE 0.236 / bias 0.004 / max absolute error 0.605 (n=40) | MAE 0.346 / RMSE 0.380 / bias 0.000 / max absolute error 0.686 (n=45) |
| HSV sin/cos hue, S, V | MAE 0.184 / RMSE 0.239 / bias 0.001 / max absolute error 0.831 (n=45) | MAE 0.154 / RMSE 0.205 / bias -0.000 / max absolute error 0.643 (n=40) | MAE 0.353 / RMSE 0.440 / bias -0.028 / max absolute error 1.734 (n=45) |
| Training-fold mean baseline | MAE 0.429 / RMSE 0.455 | — | — |

HSV had the lowest combined MAE among the four candidates, only slightly below RGB and Lab. That difference is not treated as evidence that hue is a reliable production feature.

### Combined HSV results by class

| Class / site | Lab pH | n strips | Mean OOF estimate | MAE | RMSE | Bias | Max absolute error | OOF estimate range |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| A / Well | 7.22 | 15 | 7.384 | 0.237 | 0.315 | 0.164 | 0.831 | 6.986–8.051 |
| SB / Fish Farm | 8.16 | 15 | 8.041 | 0.181 | 0.205 | -0.119 | 0.376 | 7.784–8.373 |
| SA / Pawikan | 8.21 | 15 | 8.168 | 0.134 | 0.173 | -0.042 | 0.366 | 7.844–8.477 |

### HSV results by reaction time and class

| Capture condition | Class | n strips | Mean OOF estimate | MAE | RMSE | Bias | Max absolute error |
|---|---|---:|---:|---:|---:|---:|---:|
| 1 minute | A | 15 | 7.324 | 0.185 | 0.249 | 0.104 | 0.643 |
| 1 minute | SB | 12 | 8.077 | 0.144 | 0.173 | -0.083 | 0.296 |
| 1 minute | SA | 13 | 8.166 | 0.126 | 0.173 | -0.044 | 0.450 |
| 20 minutes | A | 15 | 7.501 | 0.512 | 0.622 | 0.281 | 1.734 |
| 20 minutes | SB | 15 | 7.999 | 0.249 | 0.277 | -0.161 | 0.448 |
| 20 minutes | SA | 15 | 8.007 | 0.296 | 0.343 | -0.203 | 0.656 |

### Per-strip combined HSV out-of-fold estimates

Each estimate is the average of the eligible image-level OOF predictions in that inferred sample group. Per-photo RGB, prediction and absolute error are in the CSV.

| Inferred sample ID* | Class | Lab pH | Mean OOF estimate | Absolute error | Eligible photos |
|---|---|---:|---:|---:|---:|
| A-01* | A | 7.220 | 7.187 | 0.033 | 2 |
| A-02* | A | 7.220 | 7.082 | 0.138 | 2 |
| A-03* | A | 7.220 | 7.276 | 0.056 | 2 |
| A-04* | A | 7.220 | 8.051 | 0.831 | 2 |
| A-05* | A | 7.220 | 7.561 | 0.341 | 2 |
| A-06* | A | 7.220 | 7.681 | 0.461 | 2 |
| A-07* | A | 7.220 | 7.628 | 0.408 | 2 |
| A-08* | A | 7.220 | 7.240 | 0.020 | 2 |
| A-09* | A | 7.220 | 6.986 | 0.234 | 2 |
| A-10* | A | 7.220 | 7.328 | 0.108 | 2 |
| A-11* | A | 7.220 | 7.252 | 0.032 | 2 |
| A-12* | A | 7.220 | 7.439 | 0.219 | 2 |
| A-13* | A | 7.220 | 7.463 | 0.243 | 2 |
| A-14* | A | 7.220 | 7.507 | 0.287 | 2 |
| A-15* | A | 7.220 | 7.079 | 0.141 | 2 |
| SA-01* | SA | 8.210 | 8.268 | 0.058 | 2 |
| SA-02* | SA | 8.210 | 8.253 | 0.043 | 2 |
| SA-03* | SA | 8.210 | 8.474 | 0.264 | 2 |
| SA-04* | SA | 8.210 | 8.123 | 0.087 | 2 |
| SA-05* | SA | 8.210 | 8.176 | 0.034 | 2 |
| SA-06* | SA | 8.210 | 8.266 | 0.056 | 2 |
| SA-07* | SA | 8.210 | 8.169 | 0.041 | 2 |
| SA-08* | SA | 8.210 | 8.119 | 0.091 | 2 |
| SA-09* | SA | 8.210 | 7.960 | 0.250 | 1 |
| SA-10* | SA | 8.210 | 8.011 | 0.199 | 2 |
| SA-11* | SA | 8.210 | 7.844 | 0.366 | 1 |
| SA-12* | SA | 8.210 | 8.002 | 0.208 | 2 |
| SA-13* | SA | 8.210 | 8.182 | 0.028 | 2 |
| SA-14* | SA | 8.210 | 8.477 | 0.267 | 2 |
| SA-15* | SA | 8.210 | 8.187 | 0.023 | 2 |
| SB-01* | SB | 8.160 | 7.901 | 0.259 | 2 |
| SB-02* | SB | 8.160 | 8.063 | 0.097 | 2 |
| SB-03* | SB | 8.160 | 7.986 | 0.174 | 2 |
| SB-04* | SB | 8.160 | 8.105 | 0.055 | 2 |
| SB-05* | SB | 8.160 | 7.940 | 0.220 | 2 |
| SB-06* | SB | 8.160 | 7.784 | 0.376 | 2 |
| SB-07* | SB | 8.160 | 8.046 | 0.114 | 1 |
| SB-08* | SB | 8.160 | 8.150 | 0.010 | 2 |
| SB-09* | SB | 8.160 | 8.373 | 0.213 | 2 |
| SB-10* | SB | 8.160 | 8.025 | 0.135 | 1 |
| SB-11* | SB | 8.160 | 7.903 | 0.257 | 2 |
| SB-12* | SB | 8.160 | 8.321 | 0.161 | 2 |
| SB-13* | SB | 8.160 | 8.251 | 0.091 | 2 |
| SB-14* | SB | 8.160 | 7.886 | 0.274 | 1 |
| SB-15* | SB | 8.160 | 7.877 | 0.283 | 2 |

* Every sample ID above is chronological-ordinal inference, not a verified physical strip identifier.

## Reaction-time color shift

For the 40 inferred pairs with quality-eligible ROIs at both times, mean 20-minute minus 1-minute Lab shift was L* **+8.706** (SD 3.233), a* **-7.276** (SD 7.593), b* **+1.065** (SD 5.216). Mean CIE76 color distance was **14.254** (SD 4.485).

| Class | Paired eligible groups | Mean ΔL* | Mean Δa* | Mean Δb* | Mean ΔE76 |
|---|---:|---:|---:|---:|---:|
| A | 15 | 10.765 | 0.248 | 5.032 | 13.535 |
| SB | 12 | 8.478 | -11.398 | -2.906 | 14.903 |
| SA | 13 | 6.539 | -12.151 | 0.153 | 14.485 |

The shift is systematic across the classes and is much larger than what can be ignored when mixing captures. No repository scanner guide or capture field selects a reaction time; runtime code only has an optional reaction-time value for report display when supplied. The app therefore cannot choose the matching calibration condition. A one-minute-only offline model is better than the 20-minute-only model on these folds, but selecting it for runtime would invent an undocumented capture condition.

## 8.16 versus 8.21 pH separability

The grouped HSV OOF distributions overlap substantially. This does **not** support 0.05-pH resolution.

| Condition | SB / 8.16 estimate (n, mean ± SD, range) | SA / 8.21 estimate (n, mean ± SD, range) | Difference in means |
|---|---|---|---:|
| combined | 15, 8.041 ± 0.173 (7.784–8.373) | 15, 8.168 ± 0.174 (7.844–8.477) | 0.127 |
| 1 minute | 12, 8.077 ± 0.159 (7.864–8.407) | 13, 8.166 ± 0.174 (7.760–8.378) | 0.089 |
| 20 minutes | 15, 7.999 ± 0.234 (7.712–8.461) | 15, 8.007 ± 0.286 (7.554–8.559) | 0.007 |

At 20 minutes the mean predicted separation is only 0.007 pH, while each class has much larger within-class spread. The combined and 1-minute intervals also overlap. Do not claim reliable distinction between these lab targets.

## Conservative transfer check

A leave-one-class-out diagnostic trained on two classes and evaluated the third uses only ROI color and holds every strip/capture from the held-out class out. It produced overall HSV MAE **0.458**, RMSE **0.590**, bias **0.239**, maximum absolute error **1.019**. In particular, held-out A / Well was predicted near the high-pH classes (MAE **0.954**, bias **+0.954**), rather than its lab target 7.22.

| Held-out class | MAE | RMSE | Bias | Max absolute error |
|---|---:|---:|---:|---:|
| A | 0.954 | 0.954 | 0.954 | 1.019 |
| SB | 0.240 | 0.277 | -0.208 | 0.483 |
| SA | 0.181 | 0.239 | -0.029 | 0.449 |

This means the fit relies on color distributions represented in known classes and does not establish robust numeric transfer across classes. The verified calibration domain remains only the three supplied class-level values 7.22, 8.16 and 8.21; it does not validate pH 1–14 or unseen water conditions.

## Production, persistence and Nitrite status

- **Production pH regression:** not added; current ROI registration, pH matching, persistence and UI behavior were not changed.
- **Class/site/GPS/filename-to-pH runtime lookup:** none added.
- **Result = History = PDF = Map:** existing code-level tests cover a supported persisted result across these surfaces; this offline dataset did not generate a new accepted production result. No client photo was presented as a new Parameters result.
- **Nitrite laboratory ground truth:** none, per client confirmation. No real-sample Nitrite accuracy claim is made; Nitrite calibration/runtime was untouched.
- **Nitrite status behavior:** existing code tests cover Safe <0.5 ppm, Warning 0.5–<1.0 ppm, Dangerous >=1.0 ppm, including qualified >1 ppm without inventing an exact concentration.

## Release decision

The evidence does not satisfy the task's production gate because the intended reaction time is undefined in the app, exact physical pairing is unavailable, close pH targets are not distinguishable, and leave-one-class-out transfer fails. No runtime model, database, UI, APK, Railway service or production data was changed. Revisit after an intended capture time is confirmed and per-strip pairing/lab evidence or additional pH standards are available.
