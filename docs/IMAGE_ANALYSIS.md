# Image Analysis and Calibration

## Processing Flow

The backend decodes the uploaded image with Sharp, applies its orientation metadata, converts pixels to sRGB, registers the client µPAD from its square and triangle reference marks, and requires two actual detected sensing circles. The circle nearest the square is Nitrite; the other circle nearest the triangle is pH. Each zone is sampled only inside a center ellipse covering 68% of its detected pad radius; the ellipse mask excludes corner, rim, and surrounding background pixels. For each ROI the engine filters luminance outliers using the median absolute deviation and calculates per-channel median RGB. The source image is retained unchanged for display and reporting.

**pH:** image -> registered right-hand pH circle -> robust median RGB -> sRGB / D65 XYZ / CIE Lab -> CIEDE2000 distance -> closest supplied Lab reference only when an explicitly configured provisional ΔE00 threshold accepts the match -> matched pH label or `PH_MEASUREMENT_UNRELIABLE`.

The supplied pH references are:

| Reference label | L* | a* | b* | Output |
| --- | ---: | ---: | ---: | --- |
| 0-4 | 50.9 | 66.5 | 54.0 | Metadata only; never a measured output |
| 5 | 65.4 | 36.1 | 68.7 | 5 |
| 6 | 86.5 | -12.3 | 80.4 | 6 |
| 7 | 58.3 | -50.0 | 37.6 | 7 |
| 8 | 49.7 | -23.8 | -13.4 | 8 |
| 9 | 36.6 | 21.7 | -57.6 | 9 |
| 10-14 | 33.4 | 51.3 | -44.4 | Metadata only; never a measured output |

The client has supplied provisional RGB intervals for individual pH levels 1–4. A registered inner pH ROI is summarized by a robust median and matched only when all three channels fall inside one unambiguous client interval. Colors outside the supplied interval are unavailable; no unpaired tolerance extension is applied. pH 0 remains unsupported because no individual pH 0 RGB reference was supplied. A matched pH 1–4 interval is provisional. Grouped `0-4` and `10-14` Lab references are retained in configuration only and excluded from production matching; an unsupported color is unavailable, never displayed as a grouped measured range. Legacy stored grouped pH records are also serialized as unavailable.

| pH | R | G | B | Provenance |
| --- | --- | --- | --- | --- |
| 1 | 167–169 | 132–134 | 122–123 | Client-provided provisional RGB |
| 2 | 171–175 | 134–142 | 130–137 | Client-provided provisional RGB |
| 3 | 169 | 130–131 | 116–113 (source order preserved; normalized to 113–116 for interval tests) | Client-provided provisional RGB |
| 4 | 166–167 | 124–127 | 123–127 | Client-provided provisional RGB |

**Nitrite (NO2-):** image -> registered left-hand Nitrite circle -> robust per-channel median RGB -> discrete inclusive matching against four client-provided provisional RGB classes. The active classes are 0 ppm (`R 182–184, G 171–173, B 179–181`), 0.5 ppm (`R 190, G 172, B 187–188`), 1 ppm (`R 193–212, G 172–194, B 173–192`), and qualified `>1 ppm` (`R 196–198, G 178–180, B 194–196`). The `>1 ppm` result has a null exact numeric value and is preserved as display text with a `>` qualifier and lower bound of 1 ppm. Only colors inside one unambiguous client-provided interval are accepted; outside colors remain unavailable and RGB distance is diagnostic only. No near-range tolerance, interpolation, extrapolation, or endpoint clamp is active. The cited secondary paper's HSV saturation feature remains research metadata only; HSV H/S/V are diagnostics and are not the production concentration model.

The client pH 1–4 RGB intervals are direct provisional reference matches and do not depend on the separate, unset CIEDE2000 acceptance threshold. A matching interval can therefore return its individual client value; no pH 0 reference is inferred from the older grouped 0–4 Lab reference. Legacy pH 5–9 behavior still requires its configured Lab threshold. The client-provided `0–4` and `10–14` Lab references are grouped ranges only and never imply an exact value within those ranges.

The direct RGB calibration is provisional and not analytically validated. The historical Nitrate-after-reduction/Nitrite-equivalent table remains compatibility/reference metadata only and is not an active Nitrite calibration. No regression, extra concentration points, or unit conversion is applied.

## µPAD Registration and ROI Configuration

The authoritative client schematic and physical measurements define a 50 mm strip, a 10 mm body height, a 2.5 mm square Reference Point 1, a 2.5 mm equilateral triangle Reference Point 2, two 5 mm sensing circles, 2.625 mm outer-reference spacing, and 5 mm circle-to-circle spacing. The schematic’s 5 mm extension lines dimension the sensing-circle diameter. The supplied edge-versus-center convention for the 2.625 mm and 5 mm spacings is still ambiguous, so the detector uses normalized schematic relationships rather than inventing a metric interpretation. Feature positions are stored as normalized template-relative coordinates derived from the schematic image. The expected order is `square -> Nitrite -> pH -> triangle -> handle`.

`backend/services/upadRegistration.js` performs image-based connected-component and contour-shape analysis. It requires a square candidate, a triangle candidate, two distinct circular sensing zones, and the expected relative ordering; the dark body contour is diagnostic and is not required when the fiducials establish a frame. The square-to-triangle anchors provide translation, rotation, and scale normalization. Triangle selection accepts softened six-vertex contours, and square scoring weighs filled-bounds evidence so a blurred square is not mistaken for the right-pointing triangle. Perspective correction is not applied; strong perspective remains fail-closed. Registration diagnostics include confidence, detected bounds, normalized coordinates, and a development-only overlay model using actual detections.

Production does not use fixed screen pixels or the legacy central crop. When registration or either circle fails, analysis returns HTTP 422 `STRIP_REGISTRATION_FAILED` and no pH or Nitrite values are persisted. Gray, dark, bright, or otherwise low-quality sensing regions return `IMAGE_QUALITY_INSUFFICIENT`. pH 1–4 can be returned only by an unambiguous direct client RGB interval match. pH 5–9 Lab matches require an explicitly configured provisional ΔE00 threshold; while it is unset, they fail closed. Nitrite has only the listed discrete RGB classes, including qualified `>1 ppm`; unsupported colors return unavailable rather than an interpolated or clamped concentration. Developer-only tests may explicitly opt into synthetic normalized ROIs with `allowDeveloperRoiFixture`; those fixtures never enable production analysis.

### Current checked-in real-image QA

The current production pipeline was run against all four available checked-in real µPAD photos. All four registered with square → Nitrite → pH → triangle roles and separate center ROIs. None of these images matched the current provisional calibration references, so all completed as scans with unavailable parameter readings; this is not a registration failure and no result was fabricated.

| Fixture | Registration | pH ROI median RGB | Closest pH Lab reference / ΔE00 | Nitrite ROI median RGB | Closest Nitrite class / RGB distance |
| --- | --- | --- | --- | --- | --- |
| `real-android-upad.jpg` | Registered | 186, 134, 104 | 5 / 15.34 | 172, 169, 163 | 0 ppm / 20.47 |
| `real-client-930-aw-1min.jpg` | Registered | 141, 151, 115 | 7 / 16.94 | 161, 154, 144 | 0 ppm / 45.87 |
| `real-client-930-aw-ph2.jpg` | Registered | 134, 146, 122 | 7 / 18.24 | 173, 139, 123 | 0 ppm / 66.62 |
| `real-client-930-c-fs-landscape.jpg` | Registered | 179, 135, 106 | 5 / 16.39 | 157, 131, 93 | 0 ppm / 99.63 |

Totals: registration 4/4; pH available 0/4, unavailable 4/4; Nitrite available 0/4, unavailable 4/4; both available 0/4, both unavailable 4/4. The pH closest Lab references are diagnostic only because no ΔE00 acceptance threshold is configured, and the direct pH 1–4 RGB ranges did not match. All Nitrite medians are outside the supplied RGB classes. The measured ROIs are centered inside their corresponding sensing circles and are inset from the detected circle boundary; deterministic smaller-center samples at 50% and 40% of the circle bounds were also evaluated and did not produce a supported match, so ROI sizing and calibration were not changed to force results. The role correction also removes the earlier false pH 2 assignment from `real-client-930-aw-ph2.jpg`; its current pH and Nitrite values are both unavailable. No camera lighting, white-balance, or sample-chemistry cause is established by these four photos alone.

## Runtime and Validation Boundary

Image decoding and analysis run in Node.js using Sharp. There is no ImageJ runtime or Python runtime dependency. Client reference data is not experimental validation: accuracy, precision, selectivity, detection/quantification limits, and real-world lighting robustness have not been established. A successful upload is `scanStatus: Completed`; measured values are `Estimated`, `measuredParametersStatus` is `Not classified` until approved limits exist, and `scientificValidationStatus` is `Pending laboratory validation`. These outputs must not be presented as certified water-safety determinations.

Software tests verify color conversion, CIEDE2000 reference behavior, ROI sampling/outlier rejection, template registration, square/triangle detection, distinct circle ordering through rotation and scale changes, random-object rejection, provisional threshold rejection, direct Nitrite RGB classes and every boundary, inclusive-range/outside matching without tolerance-based result extension, explicit out-of-range behavior without endpoint clamping, image format decoding, separate synthetic developer ROIs, gray/background rejection, and explicit failure when registration is absent. A synthetic image can verify software flow only; it cannot validate analytical performance. Historical Nitrate database values remain historical and are never reinterpreted as Nitrite.

### Remaining client inputs

Paired known-concentration Nitrite samples, confirmed units/species, controlled reaction timing and lighting, an approved pH Lab-match threshold or additional paired pH calibration samples, and approved Nitrite classification thresholds are still required before results can be reliably classified or analytical validity established. The current available real photos do not match the supplied reference colors. The schematic and software tests do not establish accuracy, linearity, LOD, LOQ, precision, or selectivity.
