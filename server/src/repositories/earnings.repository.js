import { pool } from '../config/db.js';

export async function insertEarning(
  { tripId, driverId, grossFare, commissionRuleId, commissionPct, commissionAmount, netEarning },
  client,
) {
  const { rows } = await client.query(
    `INSERT INTO driver_earnings
       (trip_id, driver_id, gross_fare, commission_rule_id, commission_pct, commission_amount, net_earning)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, net_earning AS "netEarning", earned_at AS "earnedAt"`,
    [tripId, driverId, grossFare, commissionRuleId, commissionPct, commissionAmount, netEarning],
  );

  return rows[0];
}

export async function listDailyForDriver(driverId, { from, to }, client = pool) {
  const { rows } = await client.query(
    `SELECT earning_date::text AS "earningDate", trips_count::int AS "tripsCount",
            gross_total AS "grossTotal", commission_total AS "commissionTotal", net_total AS "netTotal"
     FROM v_driver_daily_earnings
     WHERE driver_id = $1 AND earning_date BETWEEN $2 AND $3
     ORDER BY earning_date DESC`,
    [driverId, from, to],
  );

  return rows;
}

export async function listTripsForDriver(driverId, { from, to }, client = pool) {
  const { rows } = await client.query(
    `SELECT de.id, t.trip_code AS "tripCode", de.gross_fare AS "grossFare",
            de.commission_pct AS "commissionPct", de.commission_amount AS "commissionAmount",
            de.net_earning AS "netEarning", de.settlement_status AS "settlementStatus",
            de.earned_at AS "earnedAt", rr.payment_intent AS "paymentMethod"
     FROM driver_earnings de
     JOIN trips t ON t.id = de.trip_id
     JOIN ride_requests rr ON rr.id = t.request_id
     WHERE de.driver_id = $1 AND de.earned_at::date BETWEEN $2 AND $3
     ORDER BY de.earned_at DESC`,
    [driverId, from, to],
  );

  return rows;
}

export async function listMonthlyForDriver(driverId, months, client = pool) {
  const { rows } = await client.query(
    `SELECT to_char(date_trunc('month', earned_at), 'YYYY-MM') AS month,
            count(*)::int AS "tripsCount",
            sum(gross_fare)::float8 AS "grossTotal",
            sum(commission_amount)::float8 AS "commissionTotal",
            sum(net_earning)::float8 AS "netTotal"
     FROM driver_earnings
     WHERE driver_id = $1 AND earned_at >= date_trunc('month', now()) - ($2 - 1) * INTERVAL '1 month'
     GROUP BY 1
     ORDER BY 1 DESC`,
    [driverId, months],
  );
  return rows;
}

export async function getStatementForMonth(driverId, month, client = pool) {
  const { rows } = await client.query(
    `SELECT u.full_name AS "driverName", u.phone AS "driverPhone", dp.license_number AS "licenseNumber",
            (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'tripCode', t.trip_code, 'earnedAt', de.earned_at, 'grossFare', de.gross_fare::float8,
                      'commissionPct', de.commission_pct::float8, 'commissionAmount', de.commission_amount::float8,
                      'netEarning', de.net_earning::float8, 'paymentMethod', rr.payment_intent)
                    ORDER BY de.earned_at), '[]'::jsonb)
             FROM driver_earnings de
             JOIN trips t ON t.id = de.trip_id
             JOIN ride_requests rr ON rr.id = t.request_id
             WHERE de.driver_id = $1 AND date_trunc('month', de.earned_at) = to_date($2, 'YYYY-MM')::timestamptz
            ) AS trips
     FROM users u JOIN driver_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1`,
    [driverId, month],
  );
  return rows[0];
}

export async function getCommissionReport({ from, to, cityId }, client = pool) {
  const params = [from, to, cityId ?? null];
  const base = `
    FROM driver_earnings de
    JOIN trips t ON t.id = de.trip_id
    JOIN ride_requests rr ON rr.id = t.request_id
    JOIN vehicle_categories vc ON vc.id = rr.category_id
    WHERE de.earned_at::date BETWEEN $1 AND $2 AND ($3::int IS NULL OR rr.city_id = $3)`;
  const measures = `
    count(*)::int AS "rides",
    COALESCE(sum(de.gross_fare), 0)::float8 AS "grossTotal",
    COALESCE(sum(de.commission_amount), 0)::float8 AS "commissionTotal",
    COALESCE(sum(de.net_earning), 0)::float8 AS "driverTotal",
    COALESCE(avg(de.gross_fare), 0)::float8 AS "avgFare",
    COALESCE(avg(de.commission_amount), 0)::float8 AS "avgCommission",
    COALESCE(sum(t.discount_amount), 0)::float8 AS "promoTotal",
    COALESCE(sum(t.actual_distance_km), 0)::float8 AS "distanceKm"`;
  const [totals, byMethod, daily, byCategory] = await Promise.all([
    client.query(`SELECT ${measures}, count(DISTINCT de.driver_id)::int AS "drivers" ${base}`, params),
    client.query(`SELECT CASE WHEN rr.payment_intent = 'cash' THEN 'cash' ELSE 'app' END AS "method", ${measures} ${base} GROUP BY 1`, params),
    client.query(`SELECT de.earned_at::date::text AS "day", ${measures} ${base} GROUP BY 1 ORDER BY 1 DESC`, params),
    client.query(`SELECT vc.name AS "category", ${measures} ${base} GROUP BY vc.name ORDER BY "commissionTotal" DESC`, params),
  ]);
  return { totals: totals.rows[0], byMethod: byMethod.rows, daily: daily.rows, byCategory: byCategory.rows };
}
