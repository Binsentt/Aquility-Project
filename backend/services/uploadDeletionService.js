import { mkdir, rename, rm, stat } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

function safeUploadFilename(imagePath) {
  if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) return null;
  const filename = imagePath.slice('/uploads/'.length);
  return filename && filename === basename(filename) ? filename : null;
}

export function createUploadDeletionService({ uploadDir = env.uploadDir, workingDirectory = process.cwd() } = {}) {
  const root = resolve(workingDirectory, uploadDir);
  const pendingDirectory = resolve(root, '.pending-delete');

  function resolveOwnedUpload(imagePath) {
    const filename = safeUploadFilename(imagePath);
    const path = filename ? resolve(root, filename) : null;
    if (!path || relative(root, path) !== filename) {
      throw new HttpError(500, 'FILE_DELETE_FAILED', 'Unable to safely remove an uploaded image.');
    }
    return { filename, path };
  }

  return {
    async stage(imagePaths = []) {
      const uniquePaths = [...new Set(imagePaths.filter(Boolean))];
      const staged = [];
      try {
        await mkdir(pendingDirectory, { recursive: true });
        for (const imagePath of uniquePaths) {
          const source = resolveOwnedUpload(imagePath);
          try {
            await stat(source.path);
          } catch (error) {
            if (error?.code === 'ENOENT') continue;
            throw error;
          }
          const pendingPath = resolve(pendingDirectory, `${randomUUID()}-${source.filename}`);
          await rename(source.path, pendingPath);
          staged.push({ sourcePath: source.path, pendingPath });
        }
      } catch (error) {
        await Promise.allSettled(staged.reverse().map(({ sourcePath, pendingPath }) => rename(pendingPath, sourcePath)));
        if (error instanceof HttpError) throw error;
        throw new HttpError(500, 'FILE_DELETE_FAILED', 'Unable to safely remove an uploaded image.');
      }

      return {
        async restore() {
          const results = await Promise.allSettled(staged.reverse().map(({ sourcePath, pendingPath }) => rename(pendingPath, sourcePath)));
          if (results.some((result) => result.status === 'rejected' && result.reason?.code !== 'ENOENT')) {
            throw new Error('Unable to restore staged uploads.');
          }
        },
        async finalize() {
          const results = await Promise.allSettled(staged.map(({ pendingPath }) => rm(pendingPath, { force: true })));
          if (results.some((result) => result.status === 'rejected')) {
            throw new Error('Unable to finalize staged uploads.');
          }
        },
      };
    },
  };
}
