import { pool } from '../config/db.js';

// driver_earnings — per-trip split of fare into platform cut + driver
// income (schema.sql). chk_driver_earnings_identity enforces
// net_earning = gross_fare - commission_amount at the DB level too.
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

// doc 08-09-10 §6: GET /driver/earnings "daily aggregates" —
// v_driver_daily_earnings IS the one canonical implementation of that
// aggregation (schema.sql), never re-derived in application code.
export async function listDailyForDriver(driverId, { from, to }, client = pool) {
  const { rows } = await client.query(
    // earning_date::text — DATE columns come back as JS Date objects by
    // default (pg's driver-level parsing), which JSON.stringify to a full
    // datetime instant, not a clean "YYYY-MM-DD" — same reasoning as
    // admin.repository.js's licenseExpiry::text cast.
    `SELECT earning_date::text AS "earningDate", trips_count AS "tripsCount",
            gross_total AS "grossTotal", commission_total AS "commissionTotal", net_total AS "netTotal"
     FROM v_driver_daily_earnings
     WHERE driver_id = $1 AND earning_date BETWEEN $2 AND $3
     ORDER BY earning_date DESC`,
    [driverId, from, to],
  );

  return rows;
}

// doc 08-09-10 §6: GET /driver/earnings "... + per-trip rows" — the same
// date window, itemized one row per trip rather than summed per day.
export async function listTripsForDriver(driverId, { from, to }, client = pool) {
  const { rows } = await client.query(
    `SELECT de.id, t.trip_code AS "tripCode", de.gross_fare AS "grossFare",
            de.commission_pct AS "commissionPct", de.commission_amount AS "commissionAmount",
            de.net_earning AS "netEarning", de.settlement_status AS "settlementStatus",
            de.earned_at AS "earnedAt"
     FROM driver_earnings de
     JOIN trips t ON t.id = de.trip_id
     WHERE de.driver_id = $1 AND de.earned_at::date BETWEEN $2 AND $3
     ORDER BY de.earned_at DESC`,
    [driverId, from, to],
  );

  return rows;
}
