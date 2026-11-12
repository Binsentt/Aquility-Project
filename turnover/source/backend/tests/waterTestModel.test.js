import test from 'node:test';
import assert from 'node:assert/strict';
import { createWaterTestModel } from '../models/waterTestModel.js';

test('water-test model persists manual coordinates separately from GPS and uses the sample point for map markers', async () => {
  const calls = [];
  const pool = {
    async query(sql, values = []) {
      calls.push({ sql, values });
      if (sql.includes('INSERT INTO water_tests')) {
        return {
          rows: [{
            id: 'manual-location-record',
            latitude: 14.6,
            longitude: 120.98,
            manualLatitude: 14.7,
            manualLongitude: 121.1,
          }],
        };
      }
      return { rows: [] };
    },
  };
  const model = createWaterTestModel(pool);

  const created = await model.create({
    userId: 'owner',
    imagePath: '/uploads/strip.jpg',
    latitude: 14.6,
    longitude: 120.98,
    manualLatitude: 14.7,
    manualLongitude: 121.1,
  });
  await model.listMarkers();

  assert.match(calls[0].sql, /manual_latitude, manual_longitude/i);
  assert.equal(calls[0].values[2], 14.6);
  assert.equal(calls[0].values[3], 120.98);
  assert.equal(calls[0].values[4], 14.7);
  assert.equal(calls[0].values[5], 121.1);
  assert.equal(created.latitude, 14.6);
  assert.equal(created.manualLatitude, 14.7);
  assert.match(calls[1].sql, /COALESCE\(manual_latitude, latitude\)/i);
  assert.match(calls[1].sql, /COALESCE\(manual_longitude, longitude\)/i);
});
