import test from 'node:test';
import assert from 'node:assert/strict';
import { assertBackendReportPayload, buildExportFileName, exportCompletionNotice, exportOutcomeNotice, saveExportToDirectory } from './exportDestination.js';

function fakeDirectory(overrides = {}) {
  const calls = [];
  const fs = {
    requestDirectoryPermissionsAsync: async () => ({ granted: true, directoryUri: 'content://tree/Documents' }),
    readDirectoryAsync: async () => [],
    createFileAsync: async (_directory, baseName, mimeType) => {
      calls.push(['create', baseName, mimeType]);
      return `content://document/${baseName}`;
    },
    readAsStringAsync: async () => 'UE5H',
    writeAsStringAsync: async (uri, contents, options) => calls.push(['write', uri, contents, options]),
    getInfoAsync: async (uri) => ({ exists: true, size: 4, uri }),
    deleteAsync: async (uri) => calls.push(['delete', uri]),
    calls,
    ...overrides,
  };
  return fs;
}

test('export filenames use canonical sample code, a safe date, and a supported extension', () => {
  assert.equal(buildExportFileName({ sampleCode: 'AA-01', capturedAt: '2026-10-03T03:00:00Z', extension: 'pdf' }), 'AQUALITY_SA-01_2026-10-03.pdf');
  assert.equal(buildExportFileName({ sampleCode: '../../unsafe name', capturedAt: 'bad-date', extension: '.png' }), 'AQUALITY_unsafe-name_undated.png');
});

test('PDF payload validation rejects missing saved records, images, or analysis fields', () => {
  assert.throws(() => assertBackendReportPayload({ resultData: { pH: '7.00', Nitrite: '0 ppm' } }), /saved AQUALITY water-test record/);
  assert.throws(() => assertBackendReportPayload({ id: 'saved', resultData: { pH: '7.00', Nitrite: '0 ppm' } }), /captured water-test image is unavailable/);
  assert.throws(() => assertBackendReportPayload({ id: 'saved', imageUri: 'https://api.test/image', resultData: { pH: 'Unavailable' } }), /analysis is incomplete/);
});

test('guest and registered saved records with backend result fields both satisfy PDF requirements', () => {
  for (const user of [{ accountType: 'guest' }, { accountType: 'registered' }]) {
    const imageUri = assertBackendReportPayload({
      id: `saved-${user.accountType}`,
      imageUri: 'https://api.test/signed-image',
      user,
      resultData: { pH: 'Unavailable', Nitrite: '>1 ppm' },
    });
    assert.equal(imageUri, 'https://api.test/signed-image');
  }
});

test('Android folder export waits for selection, writes base64, and verifies the visible file', async () => {
  const fs = fakeDirectory();
  const result = await saveExportToDirectory({ uri: 'file://private/report.pdf', fileName: 'AQUALITY_SA-01_2026-10-03.pdf', mimeType: 'application/pdf' }, fs);

  assert.equal(result.status, 'saved');
  assert.equal(result.fileName, 'AQUALITY_SA-01_2026-10-03.pdf');
  assert.equal(fs.calls[0][0], 'create');
  assert.equal(fs.calls[0][1], 'AQUALITY_SA-01_2026-10-03');
  assert.deepEqual(fs.calls[1], ['write', 'content://document/AQUALITY_SA-01_2026-10-03', 'UE5H', { encoding: 'base64' }]);
});

test('PDF and image exports each report success only after their selected-folder file verifies', async () => {
  for (const [extension, mimeType] of [['pdf', 'application/pdf'], ['png', 'image/png']]) {
    const fs = fakeDirectory();
    const result = await saveExportToDirectory({
      uri: `file://private/report.${extension}`,
      fileName: `AQUALITY_SA-01_2026-10-03.${extension}`,
      mimeType,
    }, fs);
    assert.equal(result.status, 'saved', extension);
    assert.equal(fs.calls[0][2], mimeType, extension);
    assert.ok(fs.calls.some(([operation]) => operation === 'write'), extension);
    assert.equal(exportCompletionNotice(extension.toUpperCase(), result)?.title, `${extension.toUpperCase()} saved`);
  }
});

test('folder picker cancellation and permission denial do not return a saved outcome', async () => {
  for (const [extension, mimeType] of [['pdf', 'application/pdf'], ['png', 'image/png']]) {
    for (const permission of [{ granted: false }, { granted: true }]) {
      const fs = fakeDirectory({ requestDirectoryPermissionsAsync: async () => permission });
      const result = await saveExportToDirectory({
        uri: `file://private/report.${extension}`,
        fileName: `AQUALITY_A-01_2026-10-03.${extension}`,
        mimeType,
      }, fs);
      assert.equal(result.status, 'not_saved', `${extension} ${JSON.stringify(permission)}`);
      assert.equal(fs.calls.length, 0);
      assert.equal(exportCompletionNotice(extension.toUpperCase(), result), null);
      assert.match(exportOutcomeNotice(extension.toUpperCase(), result).title, /not completed/i);
    }
  }
});

test('repeated saves choose a distinct name instead of overwriting', async () => {
  const fs = fakeDirectory({
    readDirectoryAsync: async () => ['content://document/AQUALITY_A-01_2026-10-03.pdf'],
  });
  const result = await saveExportToDirectory({ uri: 'file://private/report.pdf', fileName: 'AQUALITY_A-01_2026-10-03.pdf', mimeType: 'application/pdf' }, fs);
  assert.equal(result.fileName, 'AQUALITY_A-01_2026-10-03_2.pdf');
  assert.equal(fs.calls[0][1], 'AQUALITY_A-01_2026-10-03_2');
});

test('write or verification failure removes the partial user-visible file and never reports success', async () => {
  const fs = fakeDirectory({
    writeAsStringAsync: async () => { throw new Error('filesystem detail'); },
  });
  await assert.rejects(
    saveExportToDirectory({ uri: 'file://private/report.pdf', fileName: 'AQUALITY_SCAN_2026-10-03.pdf', mimeType: 'application/pdf' }, fs),
    /Unable to save the export in the selected folder/,
  );
  assert.deepEqual(fs.calls.at(-1), ['delete', 'content://document/AQUALITY_SCAN_2026-10-03']);
});

test('success notice is only available after the public destination confirms a saved file', () => {
  assert.deepEqual(exportCompletionNotice('PDF', { status: 'saved', fileName: 'AQUALITY_A-01.pdf' }), {
    title: 'PDF saved',
    message: 'AQUALITY_A-01.pdf is available in the folder you selected.',
  });
  for (const result of [null, { status: 'shared' }, { status: 'not_saved' }, { status: 'failed' }]) {
    assert.equal(exportCompletionNotice('PDF', result), null);
  }
  assert.equal(exportOutcomeNotice('PDF', { status: 'not_saved' }).title, 'Save not completed');
  assert.equal(exportOutcomeNotice('PDF', { status: 'shared' }), null);
});
