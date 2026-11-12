function toUser(row) {
  if (!row) return null;

  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phoneNumber: row.phoneNumber,
    barangay: row.barangay,
    municipality: row.municipality,
    passwordHash: row.passwordHash,
    accountType: row.accountType,
    isArchived: row.isArchived,
    archivedAt: row.archivedAt,
    guestExpiresAt: row.guestExpiresAt,
    lastActiveAt: row.lastActiveAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const userColumns = `
  id,
  full_name AS "fullName",
  email,
  phone_number AS "phoneNumber",
  barangay,
  municipality,
  password_hash AS "passwordHash",
  account_type AS "accountType",
  is_archived AS "isArchived",
  archived_at AS "archivedAt",
  guest_expires_at AS "guestExpiresAt",
  last_active_at AS "lastActiveAt",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export function createUserModel(pool) {
  return {
    async create({ fullName, email = null, phoneNumber = null, barangay = null, municipality = null, passwordHash = null, accountType, guestExpiresAt = null }) {
      const { rows } = await pool.query(
        `INSERT INTO users (full_name, email, phone_number, barangay, municipality, password_hash, account_type, guest_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${userColumns}`,
        [fullName, email || null, phoneNumber || null, barangay || null, municipality || null, passwordHash, accountType, guestExpiresAt]
      );
      return toUser(rows[0]);
    },

    async list() {
      const { rows } = await pool.query(`SELECT ${userColumns} FROM users WHERE is_archived = FALSE ORDER BY created_at DESC`);
      return rows.map(toUser);
    },

    async findById(id) {
      const { rows } = await pool.query(`SELECT ${userColumns} FROM users WHERE id = $1`, [id]);
      return toUser(rows[0]);
    },

    async findActiveById(id) {
      const { rows } = await pool.query(`SELECT ${userColumns} FROM users WHERE id = $1 AND is_archived = FALSE`, [id]);
      return toUser(rows[0]);
    },

    async findByIdForDeletion(id, executor = pool) {
      const { rows } = await executor.query(`SELECT ${userColumns} FROM users WHERE id = $1 FOR UPDATE`, [id]);
      return toUser(rows[0]);
    },

    async findByEmail(email) {
      const { rows } = await pool.query(`SELECT ${userColumns} FROM users WHERE LOWER(email) = LOWER($1)`, [email]);
      return toUser(rows[0]);
    },

    async update(id, { fullName, email, phoneNumber, barangay, municipality }) {
      const { rows } = await pool.query(
        `UPDATE users
         SET full_name = $2, email = $3, phone_number = $4, barangay = $5, municipality = $6, updated_at = NOW()
         WHERE id = $1 AND is_archived = FALSE
         RETURNING ${userColumns}`,
        [id, fullName, email || null, phoneNumber || null, barangay || null, municipality || null]
      );
      return toUser(rows[0]);
    },

    async remove(id) {
      const { rowCount } = await pool.query('DELETE FROM users WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async removeOwned(id, executor = pool) {
      const { rowCount } = await executor.query('DELETE FROM users WHERE id = $1', [id]);
      return rowCount > 0;
    },

    async touchActiveSession(id, guestArchiveDays) {
      const { rows } = await pool.query(
        `UPDATE users
         SET last_active_at = NOW(),
             guest_expires_at = CASE
               WHEN account_type = 'guest' THEN NOW() + make_interval(days => $2::int)
               ELSE guest_expires_at
             END
         WHERE id = $1 AND is_archived = FALSE
         RETURNING ${userColumns}`,
        [id, guestArchiveDays]
      );
      return toUser(rows[0]);
    },

    async archiveGuest(id) {
      const { rows } = await pool.query(
        `UPDATE users
         SET is_archived = TRUE,
             archived_at = NOW()
         WHERE id = $1 AND account_type = 'guest' AND is_archived = FALSE
         RETURNING ${userColumns}`,
        [id]
      );
      return toUser(rows[0]);
    },

    async archiveExpiredGuests(cutoff) {
      const { rows } = await pool.query(
        `UPDATE users
         SET is_archived = TRUE,
             archived_at = NOW()
         WHERE account_type = 'guest'
           AND is_archived = FALSE
           AND (guest_expires_at <= NOW() OR last_active_at <= $1)
         RETURNING ${userColumns}`,
        [cutoff]
      );
      return rows.map(toUser);
    },

  };
}
