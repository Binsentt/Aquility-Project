import { generateCalibrationQaReport } from '../services/calibrationQaReport.js';

const imagePaths = process.argv.slice(2);
if (imagePaths.length === 0) {
  process.stderr.write('Usage: node scripts/calibration-qa-report.js <image-path> [image-path ...]\n');
  process.exitCode = 1;
} else {
  try {
    const report = await generateCalibrationQaReport(imagePaths);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } catch {
    process.stderr.write('Calibration QA report could not load the active analysis configuration. No data was changed.\n');
    process.exitCode = 1;
  }
}
