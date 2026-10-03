# AQUALITY calibration QA readiness

## Candidate paired-reference CSV

`backend/database/calibration-candidates.template.csv` is a header-only worksheet for future client-approved paired calibration/reference records. It contains no measurements and is not a production input. The `approved` column is metadata only: setting it to `true` does not activate, load, or change any calibration.

The columns are `sample_id`, `parameter`, `reference_value`, `reference_unit`, `reference_source`, `image_file`, `measured_r`, `measured_g`, `measured_b`, `capture_condition`, `capture_date`, `notes`, and `approved`. Add records only from client-approved laboratory/reference measurements paired to the corresponding source images and documented capture conditions. Do not infer values from study-site labels or the current provisional output.

Production continues to read only `backend/database/colorAnalysisCalibration.json`; the QA command does not read the candidate CSV. The active classification `thresholds` value remains `null` until the client supplies approved pH and Nitrite classification limits. No Safe/Warning/Dangerous Nitrite thresholds are implied here.

## Read-only image diagnostics

From `backend/`, run:

```powershell
node scripts/calibration-qa-report.js "tests/fixtures/real-client-930-aw-1min.jpg"
```

The command runs each image through the existing production `colorAnalysisEngine` (Sharp decode, registered template ROIs, and the current active reference matching). Its JSON output includes the image basename, registration status, separate pH and Nitrite ROI median RGB values, nearest configured references, distances/diagnostics, and whether the production engine accepted each result or returned it unavailable. Source filesystem paths are not emitted. Unregistered/invalid images produce unavailable fields rather than estimates.

The report is read-only: it does not insert/update database rows, write files, modify the active calibration JSON, or interpret worksheet approval flags. Distances are diagnostics, not new acceptance thresholds. Acceptance is copied from the existing production engine. This report and passing software tests do not establish analytical accuracy, linearity, LOD, LOQ, precision, selectivity, or scientific validation.

## Future calibration replacement

The client still needs to provide paired reference values and images, approved capture/reaction conditions, and the exact Nitrite Safe/Warning/Dangerous thresholds. Review paired records scientifically before updating the production calibration/configuration through the existing backend analysis path; never load this template automatically.
