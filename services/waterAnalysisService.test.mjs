import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeWaterTest } from './waterAnalysisService.js';

function jsonResponse(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return body; },
  };
}

test('manual-location analysis stops before upload when the backend lacks the location capability', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(200, { status: 'ok', service: 'aquility-api' });
  };

  try {
    await assert.rejects(
      () => analyzeWaterTest('file:///tmp/water-strip.jpg', {
        userId: 'user-1',
        manualLocation: { latitude: 14.7, longitude: 121.1 },
        capturedAt: '2026-08-04T00:01:00.000Z',
      }),
      { code: 'MANUAL_LOCATION_UNSUPPORTED' },
    );
    assert.equal(requests.length, 1);
    assert.match(requests[0].url, /\/health$/);
  } finally {
    global.fetch = originalFetch;
  }
});

test('manual-location analysis uploads only after backend capability confirmation', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    if (url.endsWith('/health')) {
      return jsonResponse(200, {
        status: 'ok',
        features: { manualSampleLocation: true },
      });
    }
    return jsonResponse(201, {
      analysisId: 'analysis-2',
      gps: { latitude: 14.6, longitude: 120.98 },
      manualLocation: { latitude: 14.7, longitude: 121.1 },
    });
  };

  try {
    const result = await analyzeWaterTest('file:///tmp/water-strip.jpg', {
      userId: 'user-1',
      location: { latitude: 14.6, longitude: 120.98 },
      manualLocation: { latitude: 14.7, longitude: 121.1 },
      capturedAt: '2026-08-04T00:01:00.000Z',
    });

    assert.equal(requests.length, 2);
    assert.match(requests[0].url, /\/health$/);
    assert.match(requests[1].url, /\/analyze-water$/);
    assert.equal(result.location.latitude, 14.7);
    assert.equal(result.actualLatitude, 14.6);
  } finally {
    global.fetch = originalFetch;
  }
});

test('classless numbered scans upload a neutral ID without inferring class from GPS', async () => {
  const originalFetch = global.fetch;
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url, options });
    return jsonResponse(201, {
      analysisId: 'classless-scan',
      sampleClass: null,
      sampleCode: 'AQ-01',
      sampleNumber: 1,
      gps: { latitude: 0, longitude: 0 },
    });
  };

  try {
    const result = await analyzeWaterTest('file:///tmp/water-strip.jpg', {
      userId: 'user-1',
      location: { latitude: 0, longitude: 0, accuracy: 5, timestamp: 1794451200000 },
      sampleCode: 'AQ-01',
      sampleNumber: 1,
      capturedAt: '2026-11-12T00:00:00.000Z',
    });

    const body = requests[0].options.body;
    assert.equal(body.get('sampleClass'), '');
    assert.equal(body.get('sampleCode'), 'AQ-01');
    assert.equal(body.get('sampleNumber'), '1');
    assert.equal(result.sampleClass, null);
    assert.equal(result.sampleCode, 'AQ-01');
  } finally {
    global.fetch = originalFetch;
  }
});
