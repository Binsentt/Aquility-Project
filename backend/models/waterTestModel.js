import { toPublicUser } from '../services/authService.js';

function toWaterTest(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.userId,
    imagePath: row.imagePath,
    latitude: row.latitude,
    longitude: row.longitude,
    sampleClass: row.sampleClass,
    siteName: row.siteName,
    sourceType: row.sourceType,
    sampleCode: row.sampleCode,
    sampleNumber: row.sampleNumber,
    barangay: row.barangay,
    municipality: row.municipality,
    capturedAt: row.capturedAt,
    gpsAccuracyMeters: row.gpsAccuracyMeters,
    gpsCapturedAt: row.gpsCapturedAt,
    canonicalLatitude: row.canonicalLatitude,
    canonicalLongitude: row.canonicalLongitude,
    estimatedPH: row.estimatedPH,
    phStatus: row.phStatus,
    estimatedNitrite: row.estimatedNitrite,
    nitriteStatus: row.nitriteStatus,
    measuredParametersStatus: row.measuredParametersStatus,
    scientificValidationStatus: row.scientificValidationStatus,
    labPH: row.labPH,
    labNitrite: row.labNitrite,
    analysisData: row.analysisData,
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
  wt.sample_class AS "sampleClass",
  wt.site_name AS "siteName",
  wt.source_type AS "sourceType",
  wt.sample_code AS "sampleCode",
  wt.sample_number AS "sampleNumber",
  wt.barangay,
  wt.municipality,
  wt.captured_at AS "capturedAt",
  wt.gps_accuracy_meters AS "gpsAccuracyMeters",
  wt.gps_captured_at AS "gpsCapturedAt",
  wt.canonical_latitude AS "canonicalLatitude",
  wt.canonical_longitude AS "canonicalLongitude",
  wt.estimated_ph AS "estimatedPH",
  wt.ph_status AS "phStatus",
  wt.estimated_nitrite AS "estimatedNitrite",
  wt.nitrite_status AS "nitriteStatus",
  wt.measured_parameters_status AS "measuredParametersStatus",
  wt.scientific_validation_status AS "scientificValidationStatus",
  wt.lab_ph AS "labPH",
  wt.lab_nitrite AS "labNitrite",
  wt.analysis_data AS "analysisData",
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
           user_id, image_path, latitude, longitude, sample_class, site_name, source_type, sample_code, sample_number, barangay, municipality, captured_at,
             gps_accuracy_meters, gps_captured_at, canonical_latitude, canonical_longitude, estimated_ph, ph_status, estimated_nitrite, nitrite_status,
             measured_parameters_status, scientific_validation_status, lab_ph, lab_nitrite, analysis_data, overall_status, remarks
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
           RETURNING *
         )
         SELECT ${waterTestColumns.replaceAll('wt.', 'inserted.')}
         FROM inserted
         JOIN users u ON u.id = inserted.user_id`,
        [
          record.userId, record.imagePath, record.latitude, record.longitude, record.sampleClass, record.siteName, record.sourceType,
          record.sampleCode, record.sampleNumber, record.barangay, record.municipality, record.capturedAt, record.gpsAccuracyMeters,
          record.gpsCapturedAt, record.canonicalLatitude, record.canonicalLongitude, record.estimatedPH, record.phStatus,
          record.estimatedNitrite, record.nitriteStatus, record.measuredParametersStatus, record.scientificValidationStatus,
          record.labPH, record.labNitrite, record.analysisData, record.overallStatus, record.remarks,
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

    async updateMetadata(id, { latitude, longitude, barangay, municipality, capturedAt, labPH, labNitrite }) {
      const { rows } = await pool.query(
        `WITH updated AS (
           UPDATE water_tests
           SET latitude = COALESCE($2, latitude),
               longitude = COALESCE($3, longitude),
               barangay = COALESCE($4, barangay),
               municipality = COALESCE($5, municipality),
               captured_at = COALESCE($6, captured_at),
               lab_ph = COALESCE($7, lab_ph),
               lab_nitrite = COALESCE($8, lab_nitrite),
               updated_at = NOW()
           WHERE id = $1
           RETURNING *
         )
         SELECT ${waterTestColumns.replaceAll('wt.', 'updated.')}
         FROM updated
         JOIN users u ON u.id = updated.user_id`,
        [id, latitude, longitude, barangay, municipality, capturedAt, labPH, labNitrite]
      );
      return toWaterTest(rows[0]);
    },

    async listMarkers() {
      const { rows } = await pool.query(
        `SELECT id, latitude, longitude, sample_class AS "sampleClass", site_name AS "siteName", source_type AS "sourceType",
                overall_status AS "overallStatus", captured_at AS "capturedAt", barangay, municipality,
                estimated_ph AS "pH",
                analysis_data #>> '{nitrite,displayValue}' AS "nitriteDisplay",
                analysis_data #>> '{nitrite,value}' AS "nitriteValue"
         FROM water_tests
         WHERE latitude IS NOT NULL AND longitude IS NOT NULL
         ORDER BY created_at DESC`
      );
      return rows.map((row) => {
        const pH = row.pH == null || String(row.pH).trim() === '' ? null : Number(row.pH);
        const nitriteValue = row.nitriteValue == null || String(row.nitriteValue).trim() === ''
          ? null
          : Number(row.nitriteValue);
        const nitriteDisplay = typeof row.nitriteDisplay === 'string' && row.nitriteDisplay.trim()
          ? row.nitriteDisplay.trim()
          : (Number.isFinite(nitriteValue) ? `${nitriteValue.toFixed(2)} ppm` : 'Unavailable');

        return {
          id: row.id,
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          overallStatus: row.overallStatus,
          capturedAt: row.capturedAt,
          barangay: row.barangay,
          municipality: row.municipality,
          sampleClass: row.sampleClass,
          siteName: row.siteName,
          sourceType: row.sourceType,
          pH: Number.isFinite(pH) ? pH : null,
          nitriteDisplay,
        };
      });
    },
  };
}
