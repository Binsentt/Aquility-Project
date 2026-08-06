import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const databaseDir = dirname(fileURLToPath(import.meta.url));
const sampleFile = join(databaseDir, 'mockWaterSamples.json');
const samples = JSON.parse(await readFile(sampleFile, 'utf8'));

if (!Array.isArray(samples.samples) || samples.samples.length === 0) {
  throw new Error('mockWaterSamples.json must contain at least one sample.');
}

console.log(`Validated ${samples.samples.length} replaceable mock water samples.`);
