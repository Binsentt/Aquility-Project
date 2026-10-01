import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const calibrationFile = join(databaseDir, 'colorAnalysisCalibration.json');
const calibration = JSON.parse(await readFile(calibrationFile, 'utf8'));

if (!Array.isArray(calibration.pH?.references)
  || calibration.nitrite?.source !== 'CLIENT_DIRECT_NITRITE_RGB'
  || calibration.nitrite?.unit !== 'ppm'
  || !Array.isArray(calibration.nitrite?.references)
  || calibration.nitrite.references.length !== 3
  || calibration.nitrite.references.map(({ value }) => value).join(',') !== '0,0.5,1'
  || calibration.nitrite.references.some((reference) => !Number.isFinite(reference.value)
    || !reference.rgbRange?.r || !reference.rgbRange?.g || !reference.rgbRange?.b)) {
  throw new Error('colorAnalysisCalibration.json is missing compatible pH or Nitrite references.');
}

console.log(`Validated pH and Nitrite calibration metadata (${calibration.version}); no experimental performance is implied.`);
