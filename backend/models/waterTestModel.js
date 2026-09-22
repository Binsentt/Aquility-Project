import { toPublicUser } from '../services/authService.js';

function toWaterTest(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    imagePath: row.imagePath,
    latitude: row.latitude,
    longitude: row.longitude,
    barangay: row.barangay,
    municipality: row.municipality,
    capturedAt: row.capturedAt,
    estimatedPH: row.estimatedPH,
    phStatus: row.phStatus,
    estimatedNitrate: row.estimatedNitrate,
    nitrateStatus: row.nitrateStatus,
    overallStatus: row.overallStatus,
    remarks: row.remarks,
    createdAt: row.createdAt,
    user: row.userId ? toPublicUser({
      id: row.userId,
      fullName: row.fullName,
      email: row.email,
      phoneNumber: row.phoneNumber,
      barangay: row.userBarangay,
      municipality: row.userMunicipality,
      accountType: row.accountType,
      createdAt: row.userCreatedAt,
    }) : null,
  };
}

const waterTestColumns = `
  wt.id,
  wt.user_id AS "userId",
  wt.image_path AS "imagePath",
  wt.latitude,
  wt.longitude,
  wt.barangay,
  wt.municipality,
  wt.captured_at AS "capturedAt",
  wt.estimated_ph AS "estimatedPH",
  wt.ph_status AS "phStatus",
  wt.estimated_nitrate AS "estimatedNitrate",
  wt.nitrate_status AS "nitrateStatus",
  wt.overall_status AS "overallStatus",
  wt.remarks,
  wt.created_at AS "createdAt",
  u.full_name AS "fullName",
  u.email,
  u.phone_number AS "phoneNumber",
  u.barangay AS "userBarangay",
  u.municipality AS "userMunicipality",
  u.account_type AS "accountType",
  u.created_at AS "userCreatedAt"
`;

export function createWaterTestModel(pool) {
  return {
    async create(record) {
      const { rows } = await pool.query(
        `WITH inserted AS (
           INSERT INTO water_tests (
             user_id, image_path, latitude, longitude, barangay, municipality, captured_at,
             estimated_ph, ph_status, estimated_nitrate, nitrate_status, overall_status, remarks
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING *
         )
         SELECT ${waterTestColumns.replaceAll('wt.', 'inserted.')}
         FROM inserted
         JOIN users u ON u.id = inserted.user_id`,
        [
          record.userId, record.imagePath, record.latitude, record.longitude, record.barangay, record.municipality,
          record.capturedAt, record.estimatedPH, record.phStatus, record.estimatedNitrate, record.nitrateStatus,
          record.overallStatus, record.remarks,
        ]
      );
      return toWaterTest(rows[0]);
    },

    async list({ userId = null } = {}) {
      const values = [];
      const whereClause = userId ? (values.push(userId), 'WHERE wt.user_id = $1') : '';
      const { rows } = await pool.query(
        `SELECT ${waterTestColumns}
         FROM water_tests wt
         JOIN users u ON u.id = wt.user_id
         ${whereClause}
         ORDER BY wt.created_at DESC`,
        values
      );
      return rows.map(toWaterTest);
    },

    async findById(id, executor = pool) {
      const { rows } = await executor.query(
        `SELECT ${waterTestColumns}
         FROM water_tests wt
         JOIN users u ON u.id = wt.user_id
         WHERE wt.id = $1`,
        [id]
      );
      return toWaterTest(rows[0]);
    },

    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM water_tests WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async removeOwned(id, userId, executor = pool) {
      const { rowCount } = await executor.query('DELETE FROM water_tests WHERE id = $1 AND user_id = $2', [id, userId]);
      return rowCount > 0;
    },

    async listOwnedForDeletion(userId, executor = pool) {
      const { rows } = await executor.query(
        `SELECT id, image_path AS "imagePath"
         FROM water_tests
         WHERE user_id = $1
         FOR UPDATE`,
        [userId]
      );
      return rows;
    },

    async updateMetadata(id, { latitude, longitude, barangay, municipality, capturedAt }) {
      const { rows } = await pool.query(
        `WITH updated AS (
           UPDATE water_tests
           SET latitude = COALESCE($2, latitude),
               longitude = COALESCE($3, longitude),
               barangay = COALESCE($4, barangay),
               municipality = COALESCE($5, municipality),
               captured_at = COALESCE($6, captured_at),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *
         )
         SELECT ${waterTestColumns.replaceAll('wt.', 'updated.')}
         FROM updated
         JOIN users u ON u.id = updated.user_id`,
        [id, latitude, longitude, barangay, municipality, capturedAt]
      );
      return toWaterTest(rows[0]);
    },

    async listMarkers() {
      const { rows } = await pool.query(
        `SELECT id, latitude, longitude, overall_status AS "overallStatus", captured_at AS "capturedAt", barangay, municipality
         FROM water_tests
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY created_at DESC`
      );
      return rows.map((row) => ({
        id: row.id,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        overallStatus: row.overallStatus,
        capturedAt: row.capturedAt,
        barangay: row.barangay,
        municipality: row.municipality,
      }));
    },
  };
}
