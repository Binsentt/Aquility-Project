# Classless Sample Identification Design

## Goal

Remove SA, A, and SB classification choices from the new scan flow while keeping every new scan identifiable and retaining historical records.

## Decision

- Keep the existing 01–15 sample-number picker, but make the selected number independent of water classification.
- Assign neutral display/storage codes `AQ-01` through `AQ-15`.
- New scans send `sampleClass`, `siteName`, and `sourceType` as absent/null. GPS and manual pins remain coordinates and never infer a class.
- Accept neutral `AQ-01`–`AQ-15` codes in API validation. Continue canonicalizing legacy SA/A/SB codes and aliases for old records and old explicit metadata.
- Do not add a database migration; the existing class, site, and source columns are nullable.
- Hide class/site rows for new records with no such metadata. Keep existing values visible for historical records.
- Replace class-derived reaction-time copy with a neutral reminder to follow the strip's approved protocol. Do not change pH or Nitrite calculations or calibration.

## Boundaries and compatibility

Classless scans must work through the mobile API mapper, backend validator, persistence serializer, Result, History, Map, PDF, and image download flows. Old records continue to display their canonical historical identity. New metadata never derives from GPS. The current production API has not yet been changed; a preview using AQ codes must not be described as end-to-end ready until the reviewed backend change is deployed.

## Verification

Regression tests cover neutral code generation and validation, upload with nullable class fields and GPS, no GPS-driven class inference, and unchanged historical aliases and serialization. Run the full backend and mobile suites, Expo config check, and security audit. Physical Android acceptance remains with the client.
