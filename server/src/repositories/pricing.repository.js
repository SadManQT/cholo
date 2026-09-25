import { pool } from '../config/db.js';

export async function getCurrentTariff(cityId, categoryId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       id, city_id AS "cityId", category_id AS "categoryId",
       base_fare::float8 AS "baseFare", per_km_rate::float8 AS "perKmRate",
       per_min_rate::float8 AS "perMinRate", minimum_fare::float8 AS "minimumFare",
       booking_fee::float8 AS "bookingFee", waiting_per_min::float8 AS "waitingPerMin",
       free_wait_minutes AS "freeWaitMinutes", cancellation_fee::float8 AS "cancellationFee"
     FROM fn_current_pricing($1, $2)`,
    [cityId, categoryId],
  );

  return rows[0];
}

export async function getCurrentCommission(categoryId, cityId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, category_id AS "categoryId", city_id AS "cityId",
            commission_pct::float8 AS "commissionPct"
     FROM fn_current_commission($1, $2)`,
    [categoryId, cityId],
  );

  return rows[0];
}

// The highest live surge for the pickup's zone (and category, when the row names one).
export async function getActiveSurgeMultiplier(cityId, categoryId, pickup, client = pool) {
  const { rows } = await client.query(
    `SELECT multiplier::float8 AS multiplier
     FROM surge_pricing
     WHERE is_active
       AND zone_id = fn_zone_at($1, $2, $3)
       AND (category_id IS NULL OR category_id = $4)
       AND starts_at <= now()
       AND (ends_at IS NULL OR ends_at > now())
     ORDER BY multiplier DESC
     LIMIT 1`,
    [pickup.lat, pickup.lng, cityId, categoryId],
  );

  return rows[0]?.multiplier ?? 1;
}
