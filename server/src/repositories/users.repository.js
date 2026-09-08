import { pool } from '../config/db.js';

// Unique violation (23505) on users.phone bubbles up to the central
// errorHandler as 409 DUPLICATE (doc 08 §9) — no separate existence check,
// which would just be a race against this same constraint.
export async function insert({ fullName, phone, passwordHash, gender }) {
  const { rows } = await pool.query(
    `INSERT INTO users (full_name, phone, password_hash, gender)
     VALUES ($1, $2, $3, $4)
     RETURNING id, public_id AS "publicId"`,
    [fullName, phone, passwordHash, gender ?? null],
  );

  return rows[0];
}

export async function findAuthByPhone(phone) {
  const { rows } = await pool.query(
    `SELECT id, public_id AS "publicId", full_name AS "fullName", phone,
            password_hash AS "passwordHash", status, phone_verified_at AS "phoneVerifiedAt"
     FROM users
     WHERE phone = $1`,
    [phone],
  );

  return rows[0];
}

export async function findById(userId) {
  const { rows } = await pool.query(
    `SELECT id, public_id AS "publicId", full_name AS "fullName", phone, email, status
     FROM users
     WHERE id = $1`,
    [userId],
  );

  return rows[0];
}

export async function markPhoneVerified(userId, client = pool) {
  await client.query(
    `UPDATE users SET phone_verified_at = now() WHERE id = $1`,
    [userId],
  );
}

// Every user has exactly one wallet by the time this runs (trg_create_user_wallet
// fires on the same INSERT that creates the user), so an inner join is safe.
export async function findMeById(userId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.public_id AS "publicId", u.full_name AS "fullName", u.phone, u.email,
            u.gender, u.date_of_birth::text AS "dateOfBirth", u.photo_url AS "photoUrl",
            u.preferred_language AS "preferredLanguage",
            u.phone_verified_at AS "phoneVerifiedAt", u.created_at AS "createdAt",
            w.balance AS "walletBalance", w.currency AS "walletCurrency"
     FROM users u
     JOIN wallets w ON w.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );

  return rows[0];
}

const PROFILE_COLUMNS = Object.freeze({
  fullName: 'full_name',
  email: 'email',
  photoUrl: 'photo_url',
  preferredLanguage: 'preferred_language',
});

// `fields` only ever comes from validate(updateMeSchema), so its keys are
// already restricted to PROFILE_COLUMNS' keys — safe to interpolate the
// resulting column names (never raw user input) into the SET clause.
export async function updateProfile(userId, fields) {
  const entries = Object.entries(fields).filter(([key]) => key in PROFILE_COLUMNS);
  if (entries.length === 0) return;

  const setClause = entries.map(([key], index) => `${PROFILE_COLUMNS[key]} = $${index + 2}`).join(', ');
  const values = entries.map(([, value]) => value);

  await pool.query(`UPDATE users SET ${setClause} WHERE id = $1`, [userId, ...values]);
}

export async function findPasswordHashById(userId) {
  const { rows } = await pool.query(
    `SELECT password_hash AS "passwordHash" FROM users WHERE id = $1`,
    [userId],
  );

  return rows[0];
}

export async function updatePasswordHash(userId, passwordHash) {
  await pool.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, userId],
  );
}
