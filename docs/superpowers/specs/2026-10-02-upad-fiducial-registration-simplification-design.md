# AQUALITY µPAD Fiducial Registration Simplification

## Goal

Make µPAD registration accept valid images using square/triangle fiducials and template-relative sensing zones without using physical dimensions, body proportions, or millimetre spacing as pass/fail criteria.

## Approved behavior

- Detect both square and triangle fiducials.
- Normalize the semantic order to square → Nitrite → pH → triangle.
- Localize separate Nitrite and pH ROIs from reliable circles or template-relative positions between the fiducials.
- Require distinct in-bounds ROIs with usable pixels.
- Reject random, blank, incomplete, or impossible objects without producing numeric results.
- Keep pH and direct 0/0.5/1 ppm Nitrite calibration unchanged.
- Return the existing successful backend result shape so the Result screen renders backend-derived values; unavailable measurements remain unavailable.

## Registration changes

Physical measurements remain in `UPAD_TEMPLATE` metadata for documentation, but are removed from registration confidence and acceptance. Body contour detection is diagnostic only. The acceptance score uses square confidence, triangle confidence, stable fiducial separation/order, ROI localization, ROI distinctness, and usable-pixel evidence. No millimetre conversion, 5:1 aspect requirement, body-size score, or `physicalPriorScore` is used to pass/fail.

## Tests

Extend registration tests for resized, rotated, and mildly cropped complete strips while retaining all existing invalid-fixture rejection. Extend analysis tests to prove separate ROI colors reach separate calibration matchers and no default numeric value is used. Preserve the existing frontend mapper/result tests that assert backend values render as the user-facing result.

## Scope

Backend registration and test files only unless a verified Result-screen regression is found. No Expo SDK, navigation, authentication, API contract, or deployment configuration changes.
