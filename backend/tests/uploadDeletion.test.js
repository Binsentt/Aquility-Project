import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createUploadDeletionService } from '../services/uploadDeletionService.js';

test('upload deletion stages files for rollback and permanently removes only finalized uploads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aquility-upload-delete-'));
  const uploadDirectory = join(root, 'uploads');
  const imagePath = join(uploadDirectory, 'strip.png');
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(imagePath, 'image-data');
  const service = createUploadDeletionService({ workingDirectory: root, uploadDir: './uploads' });

  try {
    const staged = await service.stage(['/uploads/strip.png']);
    await assert.rejects(access(imagePath));
    await staged.restore();
    await access(imagePath);

    const finalized = await service.stage(['/uploads/strip.png']);
    await finalized.finalize();
    await assert.rejects(access(imagePath));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('upload deletion rejects traversal-like stored paths before touching the filesystem', async () => {
  const root = await mkdtemp(join(tmpdir(), 'aquility-upload-delete-'));
  const service = createUploadDeletionService({ workingDirectory: root, uploadDir: './uploads' });

  try {
    await assert.rejects(
      service.stage(['/uploads/../outside.png']),
      (error) => error.code === 'FILE_DELETE_FAILED'
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
