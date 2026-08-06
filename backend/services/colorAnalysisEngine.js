import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'database');

async function readFixture(name) {
  return JSON.parse(await readFile(join(databaseDir, name), 'utf8'));
}

export function createColorAnalysisEngine({ readJson = readFixture } = {}) {
  let fixturesPromise;

  async function loadFixtures() {
    if (!fixturesPromise) {
      fixturesPromise = Promise.all([
        readJson('mockCalibration.json'),
        readJson('mockColorReference.json'),
        readJson('mockWaterSamples.json'),
      ]).then(([calibration, colorReference, waterSamples]) => ({ calibration, colorReference, waterSamples }));
    }
    return fixturesPromise;
  }

  return {
    async analyze({ imagePath }) {
      if (!imagePath) {
        throw new Error('An image path is required for analysis.');
      }

      const { calibration, colorReference, waterSamples } = await loadFixtures();
      const sample = waterSamples.samples.find((entry) => entry.id === 'safe-reference');
      if (!sample || !calibration.markers || !colorReference.pH) {
        throw new Error('Mock analysis fixtures are incomplete.');
      }

      return {
        pH: sample.pH,
        phStatus: sample.phStatus,
        nitrate: sample.nitrate,
        nitrateStatus: sample.nitrateStatus,
        copper: sample.copper,
        copperStatus: sample.copperStatus,
        overallStatus: sample.overallStatus,
        remarks: sample.remarks,
      };
    },
  };
}
