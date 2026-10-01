import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMultipartFile } from './multipartUpload.js';

const apiClientSource = readFileSync(new URL('./apiClient.js', import.meta.url), 'utf8');

test('multipart analysis appends an Expo-compatible file/blob part, not the legacy URI object', async () => {
  const upload = await createMultipartFile('file:///tmp/water-strip.jpg', {
    source: 'camera',
    fileName: 'water-strip.jpg',
    mimeType: 'image/jpeg',
  });

  assert.ok(upload.file instanceof Blob);
  assert.notEqual(Object.getPrototypeOf(upload.file), Object.prototype);
  assert.match(apiClientSource, /formData\.append\('image', upload\.file\)/);
  assert.doesNotMatch(apiClientSource, /formData\.append\('image',\s*\{\s*uri:/);
});

test('multipart upload keeps the Expo fetch and File implementations isolated to upload requests', () => {
  const multipartUploadSource = readFileSync(new URL('./multipartUpload.js', import.meta.url), 'utf8');
  const nativeMultipartSource = readFileSync(new URL('./nativeMultipartUpload.js', import.meta.url), 'utf8');

  assert.doesNotMatch(apiClientSource, /import\(/);
  assert.doesNotMatch(multipartUploadSource, /import\(/);
  assert.match(nativeMultipartSource, /import \{ fetch as expoFetch \} from ['"]expo\/fetch['"]/);
  assert.match(nativeMultipartSource, /import \{ File, Paths \} from ['"]expo-file-system['"]/);
  assert.match(nativeMultipartSource, /from ['"]expo-file-system\/legacy['"]/);
  assert.match(nativeMultipartSource, /from ['"]expo-image-manipulator['"]/);
  assert.match(nativeMultipartSource, /new File\(sourceUri\)/);
});
