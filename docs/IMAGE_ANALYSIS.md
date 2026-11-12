# Image Analysis and Calibration

## Processing Flow

The backend decodes the uploaded image with Sharp, applies its orientation metadata, converts pixels to sRGB, and samples a configured normalized region of interest (ROI). For each ROI it filters luminance outliers using the median absolute deviation and calculates per-channel median RGB. The source image is retained unchanged for display and reporting.

**pH:** image -> ROI -> robust median RGB -> sRGB / D65 XYZ / CIE Lab -> CIEDE2000 distance -> closest supplied Lab reference -> matched pH label.

The supplied pH references are:

| Reference label | L* | a* | b* | Output |
| --- | ---: | ---: | ---: | --- |
| 0-4 | 50.9 | 66.5 | 54.0 | Grouped range `0-4` |
| 5 | 65.4 | 36.1 | 68.7 | 5 |
| 6 | 86.5 | -12.3 | 80.4 | 6 |
| 7 | 58.3 | -50.0 | 37.6 | 7 |
| 8 | 49.7 | -23.8 | -13.4 | 8 |
| 9 | 36.6 | 21.7 | -57.6 | 9 |
| 10-14 | 33.4 | 51.3 | -44.4 | Grouped range `10-14` |

Grouped references remain grouped outputs; they do not identify an exact value within those ranges. Additional client RGB examples are retained as metadata and are not introduced as extra calibration points.

**Nitrite (NO2-):** image -> ROI -> robust median RGB -> standard HSV hue in degrees (0-360) -> piecewise-linear interpolation -> Nitrite concentration in ppm, clamped to the supplied endpoints.

| Hue (degrees) | Nitrite (ppm) |
| ---: | ---: |
| 15 | 0 |
| 30 | 10 |
| 50 | 25 |
| 90 | 100 |

The nitrite calibration is provisional. The software uses the hue convention documented in `backend/database/colorAnalysisCalibration.json`; the client must confirm that the supplied hue points use standard HSV degrees. No regression, extra calibration points, or ppm-to-micromolar conversion is applied. The supplied micromolar table is reference metadata only.

## ROI Configuration

Edit the `roi` object in `backend/database/colorAnalysisCalibration.json`. `fallback` and each parameter region use normalized `x`, `y`, `width`, and `height` fractions in the range 0-1, so ROI selection is independent of image resolution. `regions.pH` and `regions.nitrite` may each be configured separately; `null` selects the fallback. The current fallback is the central 20% (`x=0.4`, `y=0.4`, `width=0.2`, `height=0.2`). Each result includes the normalized ROI, pixel bounds, robust statistic, sample count, and whether a configured ROI or fallback was used.

The physical pad coordinates were not supplied. The center crop is a documented temporary fallback, not automatic pad detection. Confirm the physical layout and configure the two regions before relying on pad-specific capture positioning. The uploaded original is never cropped or rewritten by analysis.

## Runtime and Validation Boundary

Image decoding and analysis run in Node.js using Sharp. There is no ImageJ runtime or Python runtime dependency. Client reference data is not experimental validation: accuracy, precision, selectivity, detection/quantification limits, and real-world lighting robustness have not been established. Results are explicitly marked `Unvalidated` and must not be presented as certified water-safety determinations.

Software tests verify color conversion, CIEDE2000 reference behavior, ROI sampling/outlier rejection, interpolation/clamping, and image format decoding. A synthetic image can verify software flow only; it cannot validate analytical performance. Historical Nitrate database values remain historical and are never reinterpreted as Nitrite.