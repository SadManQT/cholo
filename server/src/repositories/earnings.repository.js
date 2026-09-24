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
            de.earned_at AS "earnedAt"
     FROM driver_earnings de
     JOIN trips t ON t.id = de.trip_id
     WHERE de.driver_id = $1 AND de.earned_at::date BETWEEN $2 AND $3
     ORDER BY de.earned_at DESC`,
    [driverId, from, to],
  );

  return rows;
}
