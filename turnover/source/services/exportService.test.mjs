import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const exportSource = readFileSync(new URL('./exportService.js', import.meta.url), 'utf8');

test('PDF export resolves the backend image URI before building report HTML', () => {
  assert.match(exportSource, /const sourceImageUri = assertBackendReportPayload\(payload\)/);
  assert.match(exportSource, /const resolvedImageUri = await resolveExportImageUri\(sourceImageUri\)/);
  assert.match(exportSource, /imageUri: resolvedImageUri/);
  assert.match(exportSource, /expo-file-system\/legacy/);
  assert.match(exportSource, /storage\.requestDirectoryPermissionsAsync/);
  assert.match(exportSource, /storage\.createFileAsync/);
  assert.match(exportSource, /FileSystem\.getInfoAsync/);
});

test('Result and History only show a save notice from the verified user-folder outcome', () => {
  for (const screenPath of ['../screens/Result/ResultScreen.js', '../screens/History/HistoryDetailScreen.js']) {
    const source = readFileSync(new URL(screenPath, import.meta.url), 'utf8');
    assert.match(source, /exportOutcomeNotice\(/);
    assert.match(source, /if \(notice\) Alert\.alert\(notice\.title, notice\.message\)/);
    assert.doesNotMatch(source, /export shared|saved in app storage/i);
  }
});
