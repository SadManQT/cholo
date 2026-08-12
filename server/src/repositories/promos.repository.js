import { pool } from '../config/db.js';

const PROMO_COLUMNS = `
  id, code, description, promo_type AS "promoType",
  value::float8 AS "value",
  max_discount::float8 AS "maxDiscount",
  min_fare::float8 AS "minFare",
  usage_limit_total AS "usageLimitTotal",
  usage_limit_per_user AS "usageLimitPerUser",
  first_ride_only AS "firstRideOnly",
  city_id AS "cityId", category_id AS "categoryId",
  valid_from AS "validFrom", valid_until AS "validUntil",
  is_active AS "isActive"
`;

// "Reserved on" only (doc 01 relationship #37) — usage-limit counting and
// the actual promo_redemptions row are redemption's job, at trip
// completion (see trips.service.js). This just answers "is this code
// applicable to this ride right now?".
export async function findApplicable(code, cityId, categoryId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       id, code, promo_type AS "promoType",
       value::float8 AS "value",
       max_discount::float8 AS "maxDiscount",
       min_fare::float8 AS "minFare"
     FROM promo_codes
     WHERE code = $1
       AND is_active = true
       AND valid_from <= now()
       AND (valid_until IS NULL OR valid_until > now())
       AND (city_id IS NULL OR city_id = $2)
       AND (category_id IS NULL OR category_id = $3)`,
    [code, cityId, categoryId],
  );

  return rows[0];
}

// Unscoped by active/date/city/category, unlike findApplicable — /promos/
// validate (promos.service.js) needs to tell "this code doesn't exist"
// (404) apart from "this code exists but doesn't apply right now" (422),
// which requires seeing the row even when it wouldn't currently apply.
export async function findByCode(code, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PROMO_COLUMNS} FROM promo_codes WHERE code = $1`,
    [code],
  );

  return rows[0];
}

// Same shape as findByCode, but FOR UPDATE and keyed by id — trips.service.
// js's completeTrip locks the promo row before re-validating and redeeming
// it, so two trips finishing at the same instant against a
// usage_limit_total-capped promo can't both read the same stale count and
// both squeeze past the limit (same "lock, then check, then act" shape as
// withdrawals.service.js's wallet hold).
export async function findByIdForUpdate(promoId, client) {
  const { rows } = await client.query(
    `SELECT ${PROMO_COLUMNS} FROM promo_codes WHERE id = $1 FOR UPDATE`,
    [promoId],
  );

  return rows[0];
}

// One query, two counts — usage_limit_total counts every redemption ever;
// usage_limit_per_user counts only this user's. Both read promo_redemptions
// (the actual redeemed rows), never ride_requests.promo_code_id — a
// reservation that never became a completed trip must not consume the limit.
export async function countRedemptions(promoId, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       count(*)::int AS "totalCount",
       count(*) FILTER (WHERE user_id = $2)::int AS "userCount"
     FROM promo_redemptions
     WHERE promo_code_id = $1`,
    [promoId, userId],
  );

  return rows[0];
}

// GET /promos/available (doc 08-09-10 §7) — active campaigns for the
// passenger's city. city_id IS NULL means a countrywide promo, same
// nullable-scope convention as findApplicable.
export async function listActiveForCity(cityId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       code, description, promo_type AS "promoType",
       value::float8 AS "value",
       max_discount::float8 AS "maxDiscount",
       min_fare::float8 AS "minFare",
       valid_until AS "validUntil"
     FROM promo_codes
     WHERE is_active = true
       AND valid_from <= now()
       AND (valid_until IS NULL OR valid_until > now())
       AND (city_id IS NULL OR city_id = $1)
     ORDER BY created_at DESC`,
    [cityId],
  );

  return rows;
}

// promo_redemptions — associative, one row per (promo, user, trip); the
// UNIQUE constraint (schema.sql) backs up completeTrip's own status-
// transition guard against redeeming the same trip twice.
export async function insertRedemption({ promoCodeId, userId, tripId, discountAmount }, client) {
  const { rows } = await client.query(
    `INSERT INTO promo_redemptions (promo_code_id, user_id, trip_id, discount_amount)
     VALUES ($1, $2, $3, $4)
     RETURNING id, redeemed_at AS "redeemedAt"`,
    [promoCodeId, userId, tripId, discountAmount],
  );

  return rows[0];
}
