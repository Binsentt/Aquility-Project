# Calibration source records

`App_Calibrate (1).xlsx` is the client-supplied source workbook. Its SHA-256 is recorded in `app-calibrate-1-extracted.json`. That extraction retains individual pH 1–8 RGB groups, the grouped pH 9–14 observations, and unlabeled Nitrite RGB values. The original source workbook is kept unchanged.

Only labeled pH groups are used as provisional color references. Matches require an empirical per-class RGB envelope as well as distance and runner-up margin gates. The grouped 9–14 label never yields an individual pH. Nitrite readings have no ppm labels and are not used quantitatively. See [`../../../docs/WORKBOOK_CALIBRATION.md`](../../../docs/WORKBOOK_CALIBRATION.md) for model precedence, confidence gates, and validation limits.
