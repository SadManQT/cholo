import { pool } from '../config/db.js';

// fn_current_pricing (doc 02-03 §7 trigger/function catalog) is the one
// canonical implementation of "which tariff applies right now" — effective-
// dated lookup, never duplicated in application code.
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

// fn_current_commission (doc 02-03 §8 T2) — same effective-dated lookup
// shape as getCurrentTariff, with commission_rules' own countrywide (NULL
// city_id) fallback baked into the function.
export async function getCurrentCommission(categoryId, cityId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, category_id AS "categoryId", city_id AS "cityId",
            commission_pct::float8 AS "commissionPct"
     FROM fn_current_commission($1, $2)`,
    [categoryId, cityId],
  );

  return rows[0];
}
