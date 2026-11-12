import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

export async function sha256File(filePath) {
  if (!filePath) return null;
  try {
    const bytes = await readFile(filePath);
    return createHash('sha256').update(bytes).digest('hex');
  } catch {
    return null;
  }
}
