import { pool } from '../config/db.js';

// Admin-managed marketplace levers: promo codes, surge rules and finance exports.

const ADMIN_PROMO_COLUMNS = `
  p.id, p.code, p.description, p.promo_type AS "promoType", p.value::float8 AS value,
  p.max_discount::float8 AS "maxDiscount", p.min_fare::float8 AS "minFare",
  p.usage_limit_total AS "usageLimitTotal", p.usage_limit_per_user AS "usageLimitPerUser",
  p.first_ride_only AS "firstRideOnly", p.city_id AS "cityId", p.category_id AS "categoryId",
  p.valid_from AS "validFrom", p.valid_until AS "validUntil", p.is_active AS "isActive",
  p.created_at AS "createdAt",
  (SELECT count(*)::int FROM promo_redemptions pr WHERE pr.promo_code_id = p.id) AS "redemptions",
  (SELECT COALESCE(sum(pr.discount_amount), 0)::float8 FROM promo_redemptions pr WHERE pr.promo_code_id = p.id)
    AS "totalDiscount"
`;

export async function listPromos({ limit, offset }, client = pool) {
  const { rows } = await client.query(
    `SELECT ${ADMIN_PROMO_COLUMNS}, count(*) OVER()::int AS "totalCount"
     FROM promo_codes p
     ORDER BY p.is_active DESC, p.created_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset],
  );
  return rows;
}

export async function findPromoById(id, client = pool) {
  const { rows } = await client.query(`SELECT ${ADMIN_PROMO_COLUMNS} FROM promo_codes p WHERE p.id = $1`, [id]);
  return rows[0];
}

const PROMO_WRITE_COLUMNS = Object.freeze({
  code: 'code',
  description: 'description',
  promoType: 'promo_type',
  value: 'value',
  maxDiscount: 'max_discount',
  minFare: 'min_fare',
  usageLimitTotal: 'usage_limit_total',
  usageLimitPerUser: 'usage_limit_per_user',
  firstRideOnly: 'first_ride_only',
  cityId: 'city_id',
  categoryId: 'category_id',
  validFrom: 'valid_from',
  validUntil: 'valid_until',
  isActive: 'is_active',
});

export async function insertPromo(input, adminId, client) {
  const entries = Object.entries(input).filter(([key]) => key in PROMO_WRITE_COLUMNS);
  const columns = [...entries.map(([key]) => PROMO_WRITE_COLUMNS[key]), 'created_by'];
  const values = [...entries.map(([, value]) => value), adminId];
  const { rows } = await client.query(
    `INSERT INTO promo_codes (${columns.join(', ')})
     VALUES (${values.map((_, index) => `$${index + 1}`).join(', ')})
     RETURNING id`,
    values,
  );
  return rows[0].id;
}

export async function updatePromo(id, input, client) {
  const entries = Object.entries(input).filter(([key]) => key in PROMO_WRITE_COLUMNS);
  if (entries.length === 0) return;
  const setClause = entries.map(([key], index) => `${PROMO_WRITE_COLUMNS[key]} = $${index + 2}`).join(', ');
  await client.query(`UPDATE promo_codes SET ${setClause} WHERE id = $1`, [id, ...entries.map(([, value]) => value)]);
}

export async function lockPromo(id, client) {
  const { rows } = await client.query(`SELECT id, code FROM promo_codes WHERE id = $1 FOR UPDATE`, [id]);
  return rows[0];
}

export async function notifyAllRiders({ title, body, payload }, client) {
  const { rowCount } = await client.query(
    `INSERT INTO notifications (user_id, category, title, body, payload)
     SELECT pp.user_id, 'promo', $1, $2, $3::jsonb
     FROM passenger_profiles pp JOIN users u ON u.id = pp.user_id
     WHERE u.status = 'active'`,
    [title, body, JSON.stringify(payload)],
  );
  return rowCount;
}

export async function listSurge({ includeEnded, limit, offset }, client = pool) {
  const { rows } = await client.query(
    `SELECT s.id, s.zone_id AS "zoneId", z.name AS "zoneName", s.category_id AS "categoryId",
            vc.name AS "categoryName", s.multiplier::float8 AS multiplier, s.reason,
            s.starts_at AS "startsAt", s.ends_at AS "endsAt", s.is_active AS "isActive",
            (s.is_active AND s.starts_at <= now() AND (s.ends_at IS NULL OR s.ends_at > now())) AS "isLive",
            s.created_at AS "createdAt", count(*) OVER()::int AS "totalCount"
     FROM surge_pricing s
     JOIN zones z ON z.id = s.zone_id
     LEFT JOIN vehicle_categories vc ON vc.id = s.category_id
     WHERE $1 OR (s.is_active AND (s.ends_at IS NULL OR s.ends_at > now()))
     ORDER BY s.starts_at DESC
     LIMIT $2 OFFSET $3`,
    [includeEnded, limit, offset],
  );
  return rows;
}

export async function insertSurge({ zoneId, categoryId, multiplier, reason, startsAt, endsAt }, adminId, client) {
  const { rows } = await client.query(
    `INSERT INTO surge_pricing (zone_id, category_id, multiplier, reason, starts_at, ends_at, created_by)
     VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, now()), $6, $7)
     RETURNING id, zone_id AS "zoneId", multiplier::float8 AS multiplier, reason,
               starts_at AS "startsAt", ends_at AS "endsAt"`,
    [zoneId, categoryId ?? null, multiplier, reason, startsAt ?? null, endsAt ?? null, adminId],
  );
  return rows[0];
}

export async function endSurge(id, client) {
  const { rows } = await client.query(
    `UPDATE surge_pricing
     SET is_active = false, ends_at = CASE WHEN ends_at IS NULL OR ends_at > now() THEN GREATEST(now(), starts_at + INTERVAL '1 second') ELSE ends_at END
     WHERE id = $1 AND is_active
     RETURNING id, zone_id AS "zoneId", multiplier::float8 AS multiplier`,
    [id],
  );
  return rows[0];
}

export async function zoneExists(zoneId, client = pool) {
  const { rowCount } = await client.query(`SELECT 1 FROM zones WHERE id = $1`, [zoneId]);
  return rowCount > 0;
}

// Finance exports. Each returns flat rows whose keys become the CSV header. Dates are Dhaka days.
const EXPORT_QUERIES = Object.freeze({
  trips: `
    SELECT t.trip_code AS "tripCode", t.status, c.name AS city, vc.name AS category,
           to_char(t.assigned_at, 'YYYY-MM-DD HH24:MI') AS "assignedAt",
           to_char(t.completed_at, 'YYYY-MM-DD HH24:MI') AS "completedAt",
           t.actual_distance_km AS "distanceKm", t.actual_duration_min AS "durationMin",
           t.total_fare AS "totalFare", t.discount_amount AS discount, t.surge_amount AS surge,
           rr.payment_intent AS "paymentMethod", t.payment_status AS "paymentStatus",
           de.commission_amount AS commission, de.net_earning AS "driverEarning",
           pu.phone AS "passengerPhone", du.phone AS "driverPhone"
    FROM trips t
    JOIN ride_requests rr ON rr.id = t.request_id
    JOIN cities c ON c.id = rr.city_id
    JOIN vehicle_categories vc ON vc.id = rr.category_id
    JOIN users pu ON pu.id = t.passenger_id
    JOIN users du ON du.id = t.driver_id
    LEFT JOIN driver_earnings de ON de.trip_id = t.id
    WHERE t.assigned_at >= $1::date AND t.assigned_at < $2::date + 1
    ORDER BY t.assigned_at`,
  payments: `
    SELECT p.public_id AS "paymentId", p.purpose, p.method_type AS method, p.gateway, p.status,
           p.amount, to_char(p.initiated_at, 'YYYY-MM-DD HH24:MI') AS "initiatedAt",
           to_char(p.completed_at, 'YYYY-MM-DD HH24:MI') AS "completedAt",
           t.trip_code AS "tripCode", u.phone AS "payerPhone", p.gateway_txn_id AS "gatewayTxnId"
    FROM payments p
    JOIN users u ON u.id = p.payer_id
    LEFT JOIN trips t ON t.id = p.trip_id
    WHERE p.initiated_at >= $1::date AND p.initiated_at < $2::date + 1
    ORDER BY p.initiated_at`,
  withdrawals: `
    SELECT w.id, u.full_name AS driver, u.phone AS "driverPhone", w.amount, w.fee, w.status,
           pa.account_type AS "accountType", pa.account_no_masked AS "accountNumber", w.gateway_ref AS "reference",
           to_char(w.requested_at, 'YYYY-MM-DD HH24:MI') AS "requestedAt",
           to_char(w.processed_at, 'YYYY-MM-DD HH24:MI') AS "processedAt"
    FROM withdrawals w
    JOIN users u ON u.id = w.driver_id
    JOIN driver_payout_accounts pa ON pa.id = w.payout_account_id
    WHERE w.requested_at >= $1::date AND w.requested_at < $2::date + 1
    ORDER BY w.requested_at`,
});

export const EXPORT_KINDS = Object.keys(EXPORT_QUERIES);

export async function exportRows(kind, { from, to }, client = pool) {
  const { rows } = await client.query(EXPORT_QUERIES[kind], [from, to]);
  return rows;
}
