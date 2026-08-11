import { pool } from '../config/db.js';

// "Reserved on" only (doc 01 relationship #37) — usage-limit counting and
// the actual promo_redemptions row are M7's job (roadmap step 21e). This
// just answers "is this code applicable to this ride right now?".
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
