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

export async function findByCode(code, client = pool) {
  const { rows } = await client.query(
    `SELECT ${PROMO_COLUMNS} FROM promo_codes WHERE code = $1`,
    [code],
  );

  return rows[0];
}

export async function findByIdForUpdate(promoId, client) {
  const { rows } = await client.query(
    `SELECT ${PROMO_COLUMNS} FROM promo_codes WHERE id = $1 FOR UPDATE`,
    [promoId],
  );

  return rows[0];
}

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

export async function insertRedemption({ promoCodeId, userId, tripId, discountAmount }, client) {
  const { rows } = await client.query(
    `INSERT INTO promo_redemptions (promo_code_id, user_id, trip_id, discount_amount)
     VALUES ($1, $2, $3, $4)
     RETURNING id, redeemed_at AS "redeemedAt"`,
    [promoCodeId, userId, tripId, discountAmount],
  );

  return rows[0];
}
