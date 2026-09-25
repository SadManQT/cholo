import { pool } from '../config/db.js';

export async function insert({ fullName, phone, passwordHash, gender }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO users (full_name, phone, password_hash, gender)
     VALUES ($1, $2, $3, $4)
     RETURNING id, public_id AS "publicId"`,
    [fullName, phone, passwordHash, gender ?? null],
  );
  // ponytail: 8 hex chars of the UUID; a clash (unique violation) is ~1 in 4 billion per pair of users.
  await client.query(
    `UPDATE users SET referral_code = upper(substr(replace(public_id::text, '-', ''), 1, 8)) WHERE id = $1`,
    [rows[0].id],
  );

  return rows[0];
}

export async function findAuthByPhone(phone) {
  const { rows } = await pool.query(
    `SELECT id, public_id AS "publicId", full_name AS "fullName", phone,
            password_hash AS "passwordHash", status, phone_verified_at AS "phoneVerifiedAt",
            suspended_until AS "suspendedUntil", suspension_reason AS "suspensionReason"
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

export async function updatePasswordHash(userId, passwordHash, client = pool) {
  await client.query(
    `UPDATE users SET password_hash = $1 WHERE id = $2`,
    [passwordHash, userId],
  );
}

// Keeps the row (trips, payments and ratings reference it) but removes personal data and frees the phone.
export async function anonymise(userId, client) {
  await client.query(
    `UPDATE users
     SET status = 'deleted', deleted_at = now(), full_name = 'Deleted user', phone = 'deleted-' || id,
         email = NULL, photo_url = NULL, date_of_birth = NULL, referral_code = NULL,
         password_hash = 'deleted'
     WHERE id = $1`,
    [userId],
  );
  await client.query(`DELETE FROM saved_places WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM emergency_contacts WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM favorite_drivers WHERE passenger_id = $1 OR driver_id = $1`, [userId]);
}
