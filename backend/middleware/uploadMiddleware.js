import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import multer from 'multer';
import { env } from '../config/env.js';
import { HttpError } from './errorHandler.js';

const uploadDirectory = resolve(process.cwd(), env.uploadDir);
mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, callback) => callback(null, uploadDirectory),
  filename: (req, file, callback) => callback(null, `${randomUUID()}.upload`),
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new HttpError(400, 'INVALID_IMAGE', 'The water-test upload must be an image.'));
      return;
    }
    callback(null, true);
  },
});

export const uploadWaterImage = upload.single('image');
