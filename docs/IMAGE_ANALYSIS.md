# Image Analysis and Calibration

## Processing Flow

The backend decodes the uploaded image with Sharp, applies its orientation metadata, converts pixels to sRGB, registers the client µPAD template from its square and triangle reference marks, and samples two distinct circular ROIs. For each ROI it filters luminance outliers using the median absolute deviation and calculates per-channel median RGB. The source image is retained unchanged for display and reporting.

**pH:** image -> registered right-hand pH circle -> robust median RGB -> sRGB / D65 XYZ / CIE Lab -> CIEDE2000 distance -> closest supplied Lab reference only when an explicitly configured provisional ΔE00 threshold accepts the match -> matched pH label or `PH_MEASUREMENT_UNRELIABLE`.

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

The client has supplied provisional RGB intervals for pH 1–4. A registered pH ROI is summarized by a robust median, then matched against those intervals (inclusive range match, or a near-range match within the configured per-channel tolerance). Ambiguous or unrelated colors return `PH_MEASUREMENT_UNRELIABLE`; pH 0 remains unsupported because no individual pH 0 RGB reference was supplied. A matched pH 1–4 interval is still provisional and must also pass the configured CIEDE2000 threshold. Grouped `0-4` and `10-14` Lab references remain range outputs when no individual RGB interval is selected.

| pH | R | G | B | Provenance |
| --- | --- | --- | --- | --- |
| 1 | 167–169 | 132–134 | 122–123 | Client-provided provisional RGB |
| 2 | 171–175 | 134–142 | 130–137 | Client-provided provisional RGB |
| 3 | 169 | 130–131 | 116–113 (source order preserved; normalized to 113–116 for interval tests) | Client-provided provisional RGB |
| 4 | 166–167 | 124–127 | 123–127 | Client-provided provisional RGB |

**Nitrite (NO2-):** image -> registered left-hand Nitrite circle -> robust per-channel median RGB -> discrete inclusive matching against the three client-provided provisional RGB classes. The active classes are 0 ppm (`R 182–184, G 171–173, B 179–181`), 0.5 ppm (`R 190, G 172, B 187–188`), and 1 ppm (`R 193–212, G 172–194, B 173–192`). Exact/in-range matches are returned as those classes only. A near match is explicitly labeled `NEAR_REFERENCE`; ambiguous colors return `NITRITE_MEASUREMENT_UNRELIABLE`; colors outside the reference space return `NITRITE_OUTSIDE_CALIBRATION_RANGE`, with a null value. No interpolation, extrapolation, or 100 ppm endpoint clamp is active. The cited secondary paper's HSV saturation feature remains research metadata only; HSV H/S/V are diagnostics and are not the production concentration model.

The direct RGB calibration is provisional and not analytically validated. The historical Nitrate-after-reduction/Nitrite-equivalent table remains compatibility/reference metadata only and is not an active Nitrite calibration. No regression, extra concentration points, or unit conversion is applied.

## µPAD Registration and ROI Configuration

The authoritative client schematic and physical measurements define a 50 mm strip, a 10 mm body height, a 2.5 mm square Reference Point 1, a 2.5 mm equilateral triangle Reference Point 2, two 5 mm sensing circles, 2.625 mm outer-reference spacing, and 5 mm circle-to-circle spacing. The schematic’s 5 mm extension lines dimension the sensing-circle diameter. The supplied edge-versus-center convention for the 2.625 mm and 5 mm spacings is still ambiguous, so the detector uses normalized schematic relationships rather than inventing a metric interpretation. Feature positions are stored as normalized template-relative coordinates derived from the schematic image. The expected order is `square -> Nitrite -> pH -> triangle -> handle`.

`backend/services/upadRegistration.js` performs image-based connected-component and contour-shape analysis. It requires a plausible dark strip body, a square candidate, a triangle candidate, two distinct circular candidates, and the expected relative ordering. The square-to-triangle anchors provide translation, rotation, and scale normalization. Perspective correction is not applied; strong perspective remains fail-closed. Registration diagnostics include confidence, detected bounds, normalized coordinates, and a development-only overlay model using actual detections.

Production does not use fixed screen pixels or the legacy central crop. When registration or either circle fails, analysis returns HTTP 422 `STRIP_REGISTRATION_FAILED` and no pH or Nitrite values are persisted. Gray, dark, bright, or otherwise low-quality sensing regions return `IMAGE_QUALITY_INSUFFICIENT`. A pH result requires a configured provisional ΔE00 threshold; it remains fail-closed while that threshold is unset. Developer-only tests may explicitly opt into synthetic normalized ROIs with `allowDeveloperRoiFixture`; those fixtures never enable production analysis.

## Runtime and Validation Boundary

Image decoding and analysis run in Node.js using Sharp. There is no ImageJ runtime or Python runtime dependency. Client reference data is not experimental validation: accuracy, precision, selectivity, detection/quantification limits, and real-world lighting robustness have not been established. A successful upload is `scanStatus: Completed`; measured values are `Estimated`, `measuredParametersStatus` is `Not classified` until approved limits exist, and `scientificValidationStatus` is `Pending laboratory validation`. These outputs must not be presented as certified water-safety determinations.

Software tests verify color conversion, CIEDE2000 reference behavior, ROI sampling/outlier rejection, template registration, square/triangle detection, distinct circle ordering through rotation and scale changes, random-object rejection, provisional threshold rejection, direct Nitrite RGB classes and every boundary, near/ambiguous/outside matching, explicit out-of-range behavior without endpoint clamping, image format decoding, separate synthetic developer ROIs, gray/background rejection, and explicit failure when registration is absent. A synthetic image can verify software flow only; it cannot validate analytical performance. Historical Nitrate database values remain historical and are never reinterpreted as Nitrite.

### Remaining client inputs

Paired known-concentration Nitrite samples, confirmed units/species, controlled reaction timing and lighting, and an approved pH ΔE00 threshold are still required to replace the provisional calibration and establish analytical validity. The schematic does not establish accuracy, linearity, LOD, LOQ, precision, or selectivity.
