import { pool } from '../config/db.js';

// Favourite drivers, referrals and user reports: the rider-to-rider/driver relationships.

export async function listFavoriteDrivers(passengerId, client = pool) {
  const { rows } = await client.query(
    `SELECT u.public_id AS id, u.full_name AS name, u.photo_url AS "photoUrl",
            dp.rating_avg AS rating, fd.created_at AS "since"
     FROM favorite_drivers fd
     JOIN users u ON u.id = fd.driver_id
     JOIN driver_profiles dp ON dp.user_id = fd.driver_id
     WHERE fd.passenger_id = $1 AND u.status = 'active'
     ORDER BY fd.created_at DESC`,
    [passengerId],
  );
  return rows;
}

/** A rider can only favourite a driver who has completed a trip with them. */
export async function findRiddenDriverId(passengerId, driverPublicId, client = pool) {
  const { rows } = await client.query(
    `SELECT u.id FROM users u
     WHERE u.public_id = $2
       AND EXISTS (SELECT 1 FROM trips t
                   WHERE t.driver_id = u.id AND t.passenger_id = $1 AND t.status = 'completed')`,
    [passengerId, driverPublicId],
  );
  return rows[0]?.id;
}

export async function addFavoriteDriver(passengerId, driverId, client = pool) {
  await client.query(
    `INSERT INTO favorite_drivers (passenger_id, driver_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [passengerId, driverId],
  );
}

export async function removeFavoriteDriver(passengerId, driverPublicId, client = pool) {
  await client.query(
    `DELETE FROM favorite_drivers fd USING users u
     WHERE fd.passenger_id = $1 AND fd.driver_id = u.id AND u.public_id = $2`,
    [passengerId, driverPublicId],
  );
}

export async function findUserIdByReferralCode(code, client = pool) {
  const { rows } = await client.query(
    `SELECT id FROM users WHERE referral_code = $1 AND status = 'active'`,
    [code],
  );
  return rows[0]?.id;
}

export async function insertReferral({ referrerId, refereeId, code }, client) {
  await client.query(
    `INSERT INTO referrals (referrer_id, referee_id, code_used) VALUES ($1, $2, $3)
     ON CONFLICT (referee_id) DO NOTHING`,
    [referrerId, refereeId, code],
  );
}

export async function findPendingReferralForUpdate(refereeId, client) {
  const { rows } = await client.query(
    `SELECT id, referrer_id AS "referrerId", referee_id AS "refereeId"
     FROM referrals WHERE referee_id = $1 AND status = 'pending' FOR UPDATE`,
    [refereeId],
  );
  return rows[0];
}

export async function markReferralRewarded(id, { tripId, bonus }, client) {
  await client.query(
    `UPDATE referrals
     SET status = 'rewarded', qualifying_trip_id = $2, referrer_bonus = $3, referee_bonus = $3, rewarded_at = now()
     WHERE id = $1`,
    [id, tripId, bonus],
  );
}

export async function getReferralSummary(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT u.referral_code AS code,
            count(r.id)::int AS invited,
            count(r.id) FILTER (WHERE r.status = 'rewarded')::int AS rewarded,
            COALESCE(sum(r.referrer_bonus) FILTER (WHERE r.status = 'rewarded'), 0)::float8 AS earned
     FROM users u
     LEFT JOIN referrals r ON r.referrer_id = u.id
     WHERE u.id = $1
     GROUP BY u.id`,
    [userId],
  );
  return rows[0];
}

export async function insertReport({ reporterId, reportedId, tripId, category, description }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO user_reports (reporter_id, reported_id, trip_id, category, description)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, category, status, created_at AS "createdAt"`,
    [reporterId, reportedId, tripId, category, description ?? null],
  );
  return rows[0];
}

export async function hasReportedTrip(reporterId, tripId, client = pool) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM user_reports WHERE reporter_id = $1 AND trip_id = $2`,
    [reporterId, tripId],
  );
  return rowCount > 0;
}

export async function listReports({ status, limit, offset }, client = pool) {
  const { rows } = await client.query(
    `SELECT ur.id, ur.category, ur.description, ur.status, ur.created_at AS "createdAt",
            ur.resolved_at AS "resolvedAt", t.trip_code AS "tripCode",
            jsonb_build_object('id', rep.id, 'name', rep.full_name, 'phone', rep.phone) AS reporter,
            jsonb_build_object('id', red.id, 'name', red.full_name, 'phone', red.phone, 'status', red.status,
                               'openReports', (SELECT count(*)::int FROM user_reports o
                                               WHERE o.reported_id = red.id AND o.status IN ('open', 'investigating')))
              AS reported,
            count(*) OVER()::int AS "totalCount"
     FROM user_reports ur
     JOIN users rep ON rep.id = ur.reporter_id
     JOIN users red ON red.id = ur.reported_id
     LEFT JOIN trips t ON t.id = ur.trip_id
     WHERE ($1::report_status IS NULL OR ur.status = $1)
     ORDER BY (ur.status IN ('open', 'investigating')) DESC, ur.created_at DESC
     LIMIT $2 OFFSET $3`,
    [status ?? null, limit, offset],
  );
  return rows;
}

export async function findReportForUpdate(id, client) {
  const { rows } = await client.query(
    `SELECT id, status, reporter_id AS "reporterId", reported_id AS "reportedId"
     FROM user_reports WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0];
}

export async function updateReportStatus(id, status, adminId, client) {
  await client.query(
    `UPDATE user_reports
     SET status = $2::report_status, handled_by = $3,
         resolved_at = CASE WHEN $2::report_status IN ('action_taken', 'dismissed') THEN now() ELSE NULL END
     WHERE id = $1`,
    [id, status, adminId],
  );
}
