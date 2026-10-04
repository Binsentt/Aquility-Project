# Real-camera calibration: missing chemistry labels

**Status:** no per-image pH or Nitrite chemistry confirmation was found in the accessible evidence. No calibration model was built and no production calibration or code was changed.

## Available unique photo inventory

The manifest contains 96 byte-unique physical µPAD photos, deduplicated by SHA-256:

- 90 client JPEGs from the extracted 9/30/26 dataset, with 15 photos in each of its six source folders.
- Four additional repository fixture photos.
- Two standalone µPAD photo attachments preserved from earlier Codex tasks. Their group, date, sample identity, and chemistry are unknown.

The CSV's 9/30 dataset image paths are relative to their original dataset root and preserve the exact group folder and source filename. Capture date and local clock time come from the camera filename; timezone is not recorded. The repository fixture rows use repository-relative paths. The two earlier photo attachments use their current Windows Temp paths; they were not copied into the repository.

The 75-photo 9/29/26 dataset described in prior task notes was not found in the workspace snapshots, Downloads, OneDrive, Pictures, Desktop, Temp, or `.codex/attachments`. The named 9/30 ZIP itself was also absent from Downloads and OneDrive, but its 90 extracted JPEGs are present in Temp. The older `Aquality System (2).zip` backup contains no reacted µPAD photos. There are no source files from which to create the 75 missing rows or calculate their ROI values.

## Production ROI pass

The 90 9/30 photos and four repository fixtures were processed by the current production calibration QA report, which uses the production image decode, registration, ROI, and color matching path. The two prior-task µPAD attachments were processed by the same report.

| Source | Photos | Registered | pH accepted | Nitrite accepted |
| --- | ---: | ---: | ---: | ---: |
| 9/30 client dataset | 90 | 86 | 0 | 0 |
| Repository fixtures | 4 | 4 | 0 | 0 |
| Prior-task photo attachments | 2 | 2 | 0 | 0 |
| **Total** | **96** | **92** | **0** | **0** |

The four 9/30 images that failed registration have no ROI RGB in the manifest:

- `AA-PS 1min (9-30-26)/IMG_20260930_224037_870.jpg`
- `C-FS 1min (9-30-26)/IMG_20260930_232457_548.jpg`
- `C-FS 1min (9-30-26)/IMG_20260930_232540_255.jpg`
- `C-FS 1min (9-30-26)/IMG_20260930_232645_803.jpg`

All other manifest rows contain separate pH and Nitrite median ROI RGB from the production pipeline. The `confirmed_ph` and `confirmed_nitrite` fields remain blank for every row. A production match or nearest reference is not evidence of the true chemistry label.

## Chemistry labels still missing

No verified image-to-chemistry label was found for any supported value:

| Parameter | Required value | Verified labeled images found |
| --- | --- | ---: |
| pH | 1 | 0 |
| pH | 2 | 0 |
| pH | 3 | 0 |
| pH | 4 | 0 |
| Nitrite | 0 ppm | 0 |
| Nitrite | 0.5 ppm | 0 |
| Nitrite | 1 ppm | 0 |
| Nitrite | >1 ppm | 0 |

The 9/30 folders provide group and reaction-time metadata (`A-W`, `AA-PS`, `C-FS`; 1 or 20 minutes). They do not provide pH or Nitrite sample concentrations. The client RGB reference table is not a mapping from those photos to known chemistry. The `real-client-930-aw-ph2.jpg` fixture contains `ph2` in its filename only; prior client instructions explicitly require that this token remain unverified unless corroborated. It is not recorded as confirmed pH 2.

The 2026-10-01 screenshot of the older grouped pH and nitrate-after-reduction/Nitrite-equivalent reference table is not a per-image chemistry record. The earlier screenshots also include an old Result screen showing pH 8.00 / Nitrite 100.00 ppm and a later Result screen showing unavailable measurements. Neither is paired with a verified sample chemistry record, so neither is ground truth; pH 8 and Nitrite 100 ppm are not used as labels.

## Exact confirmation needed

For each of the 96 image rows, supply a source-backed value in `confirmed_ph` (1, 2, 3, or 4) and `confirmed_nitrite` (0, 0.5, 1, or >1 ppm), leaving a field blank if it is not known. Record the lab/reference record or client statement in `label_source`. Do not derive these values from the image filename, group, current matcher, or displayed result. Keep `approved_for_calibration` as `NO` until the labels are reviewed and approved.

To inventory the additional 75 photos described for 9/29/26, the missing 9/29 source archive or extracted photo files are also required. Their filenames and ROI RGB cannot be populated from the current available files.
