# Computed pH and Nitrite result guarantees

This note records the production data path and the automated regression coverage
for the pH and Nitrite results. It does not change runtime code, calibration
references, ROI geometry, or UI behavior.

## Runtime result path

1. `backend/routes/analysisRoutes.js` accepts the uploaded image and calls the
   analysis controller. `backend/services/waterAnalysisService.js` validates
   sample metadata and GPS, resolves site/class labels, validates the uploaded
   image, then calls `colorAnalysisEngine.analyze({ imagePath, debugLogger })`.
   The engine receives the stored image path; sample class/code, site, source,
   coordinates, account, and filename are not passed as measurement inputs.
2. `backend/services/colorAnalysisEngine.js` decodes the image with Sharp,
   detects the square/triangle and circular sensing zones when production
   registration is enabled, and extracts independent pH and Nitrite ROI
   statistics with `extractRoiStatistics`.
3. The pH measurement is matched from measured ROI RGB against the configured
   client RGB ranges (with an exact numeric Lab reference permitted when its
   configured threshold is met). Nitrite is matched from its measured ROI RGB
   against configured Nitrite RGB references. These configured references are
   calibration inputs; the output value is selected by matching the measured
   image ROI. A color without a qualifying match has no numeric result.
4. `waterAnalysisService.js` stores `estimatedPH` from
   `measurements.pH.value`, `estimatedNitrite` from
   `measurements.nitrite.value`, and the full measured objects and ROI metadata
   in `analysisData`. A qualified `>1 ppm` Nitrite result keeps its display
   qualifier in `analysisData.nitrite.displayValue`; its exact numeric value is
   null because the reference only supports a lower bound.
5. `backend/models/waterTestModel.js` persists and reads those saved values.
   `backend/utils/waterTestSerializer.js` builds API `pH`, `nitrite`, and
   `resultData` from the saved measurement objects and computed estimates. Its
   scalar-field handling supports older saved records; it does not derive a
   measurement from site/sample/GPS metadata. Historical Nitrate-only records
   remain unavailable as Nitrite.
6. `services/apiMappers.js` maps the API measurement fields into the scan
   `resultData`. Result and History screens display that saved `resultData`;
   `services/reportTemplate.js` uses it for PDF output; map markers use the
   saved pH and Nitrite display values. The pH category is a presentation label
   derived from the already computed pH value.

## Fallback audit

The production analyzer has no fixed pH or Nitrite result for unmatched colors,
and no site-, class-, GPS-, account-, filename-, or center-crop-based result
path. The matcher returns an unavailable match when measured RGB is outside the
configured references. The serializer explicitly leaves historical
Nitrate-only records uninterpreted as Nitrite. Calibration reference values,
sample site labels, and class metadata remain static configuration by design;
they do not supply the final scan result.

## Regression coverage

- `backend/tests/client-image-analysis.test.js` exercises the authenticated
  upload-to-persistence-to-serialization path: the same image under SA/Pawikan,
  A/Well, and SB/Fish Farm metadata and different GPS; then different sensing
  RGB under fixed metadata, including unsupported RGB that remains
  “No reference match”.
- `backend/tests/color-analysis.test.js` checks measured-ROI matching for pH
  1–4, Nitrite 0/0.5/1/>1 ppm, outside-reference rejection, and separate ROIs
  rather than a center crop.
- `backend/tests/upad-registration.test.js` checks the registered production
  pipeline returns pH and Nitrite from their separate sensing circles.
- `backend/tests/analysis.test.js` checks historical Nitrate-only data does not
  become Nitrite. Existing backend and frontend service tests cover the saved
  Result, History, Map, PDF/export, authentication/session, and privacy paths.

Real client scans may continue to report “No reference match” until paired,
labeled camera calibration samples support a valid mapping. No calibration
values are inferred or added by these guards.
