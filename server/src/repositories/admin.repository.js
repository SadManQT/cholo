import { pool } from '../config/db.js';

// admin_profiles.access_level (doc 08-09-10 §9: "a second dimension...
// checked in services") — never in the JWT (roles are; access_level
// isn't), so every access-level-gated action needs this DB read.
export async function getAccessLevel(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT access_level AS "accessLevel" FROM admin_profiles WHERE user_id = $1`,
    [userId],
  );

  return rows[0]?.accessLevel;
}

export async function listDriverApplications({ status, limit, offset }, client = pool) {
  const { rows } = await client.query(
    `WITH latest_documents AS (
       SELECT DISTINCT ON (driver_id, doc_type)
              id, driver_id, doc_type, status, expiry_date, uploaded_at,
              file_url, doc_number, rejection_reason
       FROM driver_documents
       ORDER BY driver_id, doc_type, uploaded_at DESC, id DESC
     )
     SELECT dp.user_id AS id, u.public_id AS "publicId",
            u.full_name AS "fullName", u.phone,
            dp.nid_number AS "nidNumber", dp.license_number AS "licenseNumber",
            dp.license_expiry::text AS "licenseExpiry",
            dp.verification_status AS "verificationStatus",
            dp.created_at AS "appliedAt",
            COUNT(*) OVER()::int AS "totalCount",
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', ld.id,
                  'docType', ld.doc_type,
                  'status', ld.status,
                  'expiryDate', ld.expiry_date,
                  'fileUrl', ld.file_url,
                  'docNumber', ld.doc_number,
                  'rejectionReason', ld.rejection_reason
                ) ORDER BY ld.doc_type
              ) FILTER (WHERE ld.id IS NOT NULL),
              '[]'::jsonb
            ) AS documents
     FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id
     LEFT JOIN latest_documents ld ON ld.driver_id = dp.user_id
     WHERE dp.verification_status = $1
     GROUP BY dp.user_id, u.public_id, u.full_name, u.phone,
              dp.nid_number, dp.license_number, dp.license_expiry,
              dp.verification_status, dp.created_at
     ORDER BY dp.created_at ASC, dp.user_id ASC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );

  const total = rows[0]?.totalCount ?? 0;
  return {
    rows: rows.map(({ totalCount: _totalCount, ...row }) => row),
    total,
  };
}

export async function getDashboardStats(cityId, client = pool) {
  const { rows } = await client.query(
    `SELECT
       (SELECT count(*)::int
          FROM trips t JOIN ride_requests rr ON rr.id = t.request_id
         WHERE t.assigned_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka'
           AND ($1::smallint IS NULL OR rr.city_id = $1)) AS "tripsToday",
       (SELECT count(*)::int FROM v_active_drivers vad
         WHERE ($1::smallint IS NULL OR vad.current_zone_id IN (SELECT id FROM zones WHERE city_id = $1))) AS "activeDrivers",
       (SELECT count(*)::int FROM driver_profiles WHERE verification_status = 'pending') AS "pendingDrivers",
       (SELECT count(*)::int FROM withdrawals WHERE status = 'requested') AS "requestedWithdrawals",
       (SELECT count(*)::int FROM disputes WHERE status IN ('open', 'under_review')) AS "openDisputes",
       (SELECT count(*)::int FROM sos_alerts WHERE status IN ('active', 'acknowledged')) AS "openSos",
       COALESCE((SELECT sum(gross_revenue) FROM v_city_monthly_revenue
         WHERE revenue_month = date_trunc('month', now())::date
           AND ($1::smallint IS NULL OR city_id = $1)), 0) AS "grossRevenueMonth",
       COALESCE((SELECT sum(platform_revenue) FROM v_city_monthly_revenue
         WHERE revenue_month = date_trunc('month', now())::date
           AND ($1::smallint IS NULL OR city_id = $1)), 0) AS "platformRevenueMonth"`,
    [cityId ?? null],
  );

  return rows[0];
}

export async function getRevenueTrend(cityId, client = pool) {
  const { rows } = await client.query(
    `WITH months AS (
       SELECT generate_series(
         date_trunc('month', now()) - interval '5 months',
         date_trunc('month', now()), interval '1 month'
       )::date AS month
     )
     SELECT m.month::text,
            COALESCE(sum(v.completed_trips), 0)::int AS "completedTrips",
            COALESCE(sum(v.gross_revenue), 0) AS "grossRevenue",
            COALESCE(sum(v.platform_revenue), 0) AS "platformRevenue"
     FROM months m
     LEFT JOIN v_city_monthly_revenue v
       ON v.revenue_month = m.month AND ($1::smallint IS NULL OR v.city_id = $1)
     GROUP BY m.month
     ORDER BY m.month`,
    [cityId ?? null],
  );

  return rows;
}

export async function listUsers({ search, status, limit, offset }, client = pool) {
  const pattern = `%${search}%`;
  const { rows } = await client.query(
    `SELECT u.id, u.public_id AS "publicId", u.full_name AS "fullName", u.phone,
            u.email, u.status, u.created_at AS "createdAt", u.last_login_at AS "lastLoginAt",
            w.balance AS "walletBalance", w.currency,
            COALESCE(array_agg(r.name ORDER BY r.name) FILTER (WHERE r.name IS NOT NULL), '{}') AS roles,
            (SELECT count(*)::int FROM trips t WHERE t.passenger_id = u.id OR t.driver_id = u.id) AS "tripCount",
            count(*) OVER()::int AS "totalCount"
     FROM users u
     JOIN wallets w ON w.user_id = u.id
     LEFT JOIN user_roles ur ON ur.user_id = u.id
     LEFT JOIN roles r ON r.id = ur.role_id
     WHERE ($1 = '' OR u.full_name ILIKE $2 OR u.phone ILIKE $2 OR COALESCE(u.email, '') ILIKE $2)
       AND ($3::text IS NULL OR u.status::text = $3)
     GROUP BY u.id, w.balance, w.currency
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT $4 OFFSET $5`,
    [search, pattern, status ?? null, limit, offset],
  );

  return rows;
}

export async function findUserForUpdate(userId, client) {
  const { rows } = await client.query(
    `SELECT u.id, u.public_id AS "publicId", u.full_name AS "fullName", u.status,
            ARRAY(SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                  WHERE ur.user_id = u.id ORDER BY r.name) AS roles
     FROM users u WHERE u.id = $1 FOR UPDATE`,
    [userId],
  );

  return rows[0];
}

export async function setUserStatus(userId, status, client) {
  const { rows } = await client.query(
    `UPDATE users SET status = $2 WHERE id = $1
     RETURNING id, public_id AS "publicId", full_name AS "fullName", status`,
    [userId, status],
  );
  return rows[0];
}

export async function listPricingRules({ cityId, categoryId, limit, offset }, client = pool) {
  const { rows } = await client.query(
    `SELECT pr.id, pr.city_id AS "cityId", c.name AS "cityName",
            pr.category_id AS "categoryId", vc.name AS "categoryName",
            pr.base_fare AS "baseFare", pr.per_km_rate AS "perKmRate",
            pr.per_min_rate AS "perMinRate", pr.minimum_fare AS "minimumFare",
            pr.booking_fee AS "bookingFee", pr.waiting_per_min AS "waitingPerMin",
            pr.free_wait_minutes AS "freeWaitMinutes", pr.cancellation_fee AS "cancellationFee",
            pr.effective_from AS "effectiveFrom", pr.effective_to AS "effectiveTo",
            pr.is_active AS "isActive", u.full_name AS "createdByName", pr.created_at AS "createdAt",
            count(*) OVER()::int AS "totalCount"
     FROM pricing_rules pr
     JOIN cities c ON c.id = pr.city_id
     JOIN vehicle_categories vc ON vc.id = pr.category_id
     LEFT JOIN users u ON u.id = pr.created_by
     WHERE ($1::smallint IS NULL OR pr.city_id = $1)
       AND ($2::smallint IS NULL OR pr.category_id = $2)
     ORDER BY pr.effective_from DESC, pr.id DESC
     LIMIT $3 OFFSET $4`,
    [cityId ?? null, categoryId ?? null, limit, offset],
  );
  return rows;
}

export async function lockPricingMarket(cityId, categoryId, client) {
  await client.query(`SELECT pg_advisory_xact_lock($1::int, $2::int)`, [cityId, categoryId]);
}

export async function findPricingOverlaps({ cityId, categoryId, effectiveFrom, effectiveTo }, client) {
  const { rows } = await client.query(
    `SELECT id, effective_from AS "effectiveFrom", effective_to AS "effectiveTo"
     FROM pricing_rules
     WHERE city_id = $1 AND category_id = $2 AND is_active
       AND ($4::timestamptz IS NULL OR effective_from < $4)
       AND (effective_to IS NULL OR effective_to > $3)
     ORDER BY effective_from`,
    [cityId, categoryId, effectiveFrom, effectiveTo ?? null],
  );
  return rows;
}

export async function closePricingRule(ruleId, effectiveTo, client) {
  await client.query(`UPDATE pricing_rules SET effective_to = $2 WHERE id = $1`, [ruleId, effectiveTo]);
}

export async function insertPricingRule(input, adminId, client) {
  const { rows } = await client.query(
    `INSERT INTO pricing_rules
       (city_id, category_id, base_fare, per_km_rate, per_min_rate, minimum_fare,
        booking_fee, waiting_per_min, free_wait_minutes, cancellation_fee,
        effective_from, effective_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id, city_id AS "cityId", category_id AS "categoryId",
               base_fare AS "baseFare", per_km_rate AS "perKmRate",
               per_min_rate AS "perMinRate", minimum_fare AS "minimumFare",
               booking_fee AS "bookingFee", waiting_per_min AS "waitingPerMin",
               free_wait_minutes AS "freeWaitMinutes", cancellation_fee AS "cancellationFee",
               effective_from AS "effectiveFrom", effective_to AS "effectiveTo", is_active AS "isActive"`,
    [input.cityId, input.categoryId, input.baseFare, input.perKmRate, input.perMinRate,
      input.minimumFare, input.bookingFee, input.waitingPerMin, input.freeWaitMinutes,
      input.cancellationFee, input.effectiveFrom, input.effectiveTo ?? null, adminId],
  );
  return rows[0];
}

export async function listVehicleApplications({ status, limit, offset }, client = pool) {
  const { rows } = await client.query(
    `WITH latest_documents AS (
       SELECT DISTINCT ON (vehicle_id, doc_type) *
       FROM vehicle_documents
       ORDER BY vehicle_id, doc_type, uploaded_at DESC, id DESC
     )
     SELECT v.id, v.driver_id AS "driverId", u.full_name AS "driverName", u.phone AS "driverPhone",
            v.registration_no AS "registrationNo", v.brand, v.model, v.model_year AS "modelYear",
            v.color, vc.name AS "categoryName", v.verification_status AS "verificationStatus",
            v.created_at AS "createdAt", count(*) OVER()::int AS "totalCount",
            COALESCE(jsonb_agg(jsonb_build_object(
              'id', ld.id, 'docType', ld.doc_type, 'status', ld.status,
              'expiryDate', ld.expiry_date, 'fileUrl', ld.file_url,
              'docNumber', ld.doc_number, 'rejectionReason', ld.rejection_reason
            ) ORDER BY ld.doc_type) FILTER (WHERE ld.id IS NOT NULL), '[]'::jsonb) AS documents
     FROM vehicles v
     JOIN users u ON u.id = v.driver_id
     JOIN vehicle_categories vc ON vc.id = v.category_id
     LEFT JOIN latest_documents ld ON ld.vehicle_id = v.id
     WHERE v.verification_status = $1
     GROUP BY v.id, u.full_name, u.phone, vc.name
     ORDER BY v.created_at ASC, v.id ASC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );
  return rows;
}
