import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const calibrationFile = join(databaseDir, 'colorAnalysisCalibration.json');
const calibration = JSON.parse(await readFile(calibrationFile, 'utf8'));

if (!Array.isArray(calibration.pH?.references) || !Array.isArray(calibration.nitrite?.huePoints)
  || !Array.isArray(calibration.nitrite?.ppmValues)
  || calibration.nitrite.huePoints.length !== calibration.nitrite.ppmValues.length) {
  throw new Error('colorAnalysisCalibration.json is missing compatible pH or Nitrite references.');
}

console.log(`Validated pH and Nitrite calibration metadata (${calibration.version}); no experimental performance is implied.`);
