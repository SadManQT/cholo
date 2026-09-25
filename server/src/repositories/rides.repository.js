import { pool } from '../config/db.js';

export async function insertRequest(
  {
    passengerId, cityId, categoryId, pickup, dropoff, stops = [],
    estDistanceKm, estDurationMin, estFare, surgeMultiplier,
    paymentIntent, promoCodeId, womenOnly, scheduledFor, expiryMinutes,
  },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO ride_requests
       (passenger_id, city_id, category_id,
        pickup_lat, pickup_lng, pickup_address,
        dropoff_lat, dropoff_lng, dropoff_address,
        est_distance_km, est_duration_min, est_fare, surge_multiplier,
        payment_intent, promo_code_id, women_only, scheduled_for,
        status, expires_at, pickup_zone_id, stops)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
             CASE WHEN $17::timestamptz IS NULL THEN 'searching' ELSE 'pending' END::ride_request_status,
             COALESCE($17::timestamptz + INTERVAL '15 minutes', now() + ($18 * INTERVAL '1 minute')),
             fn_zone_at($4, $5, $2), $19::jsonb)
     RETURNING id, public_id AS "publicId", status, scheduled_for AS "scheduledFor",
               requested_at AS "requestedAt", expires_at AS "expiresAt"`,
    [
      passengerId, cityId, categoryId,
      pickup.lat, pickup.lng, pickup.address ?? null,
      dropoff.lat, dropoff.lng, dropoff.address ?? null,
      estDistanceKm, estDurationMin, estFare, surgeMultiplier,
      paymentIntent, promoCodeId ?? null, womenOnly, scheduledFor ?? null,
      expiryMinutes,
      stops.length > 0 ? JSON.stringify(stops.map(({ lat, lng, address }) => ({ lat, lng, address: address ?? null }))) : null,
    ],
  );

  return rows[0];
}

export async function lockPassengerBooking(passengerId, client) {
  await client.query(`SELECT pg_advisory_xact_lock($1::bigint)`, [passengerId]);
}

export async function findForUpdate(requestId, client) {
  const { rows } = await client.query(
    `SELECT id, passenger_id AS "passengerId", status,
            pickup_lat::float8 AS "pickupLat", pickup_lng::float8 AS "pickupLng",
            pickup_address AS "pickupAddress", stops
     FROM ride_requests
     WHERE id = $1
     FOR UPDATE`,
    [requestId],
  );

  return rows[0];
}

const REQUEST_STATUS_COLUMNS = `
  rr.id, rr.public_id AS "publicId", rr.passenger_id AS "passengerId",
  rr.status, rr.pickup_lat::float8 AS "pickupLat",
  rr.pickup_lng::float8 AS "pickupLng", rr.pickup_address AS "pickupAddress",
  rr.dropoff_lat::float8 AS "dropoffLat",
  rr.dropoff_lng::float8 AS "dropoffLng", rr.dropoff_address AS "dropoffAddress",
  rr.est_distance_km::float8 AS "estDistanceKm",
  rr.est_duration_min AS "estDurationMin", rr.est_fare AS "estFare",
  rr.surge_multiplier AS "surgeMultiplier", rr.payment_intent AS "paymentIntent",
  rr.stops, rr.scheduled_for AS "scheduledFor", vc.name AS "categoryName",
  rr.requested_at AS "requestedAt", rr.expires_at AS "expiresAt",
  rr.cancelled_at AS "cancelledAt", t.trip_code AS "tripCode"
`;

export async function findByPublicIdForPassenger(publicId, passengerId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${REQUEST_STATUS_COLUMNS}
     FROM ride_requests rr
     JOIN vehicle_categories vc ON vc.id = rr.category_id
     LEFT JOIN trips t ON t.request_id = rr.id
     WHERE rr.public_id = $1 AND rr.passenger_id = $2`,
    [publicId, passengerId],
  );

  return rows[0];
}

export async function listActiveForPassenger(passengerId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${REQUEST_STATUS_COLUMNS}
     FROM ride_requests rr
     JOIN vehicle_categories vc ON vc.id = rr.category_id
     LEFT JOIN trips t ON t.request_id = rr.id
     WHERE rr.passenger_id = $1 AND rr.status IN ('pending', 'searching')
     ORDER BY (rr.status = 'searching') DESC, COALESCE(rr.scheduled_for, rr.requested_at)`,
    [passengerId],
  );

  return rows;
}

export async function countUpcomingScheduled(passengerId, client = pool) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS count FROM ride_requests
     WHERE passenger_id = $1 AND status = 'pending' AND scheduled_for IS NOT NULL`,
    [passengerId],
  );
  return rows[0].count;
}

export async function hasSearchingRequest(passengerId, client = pool) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM ride_requests WHERE passenger_id = $1 AND status = 'searching' LIMIT 1`,
    [passengerId],
  );
  return rowCount > 0;
}

export async function claimScheduledReminders(leadMinutes, client) {
  const { rows } = await client.query(
    `UPDATE ride_requests SET reminder_sent_at = now()
     WHERE status = 'pending' AND scheduled_for IS NOT NULL AND reminder_sent_at IS NULL
       AND scheduled_for <= now() + ($1 * INTERVAL '1 minute')
     RETURNING id, public_id AS "publicId", passenger_id AS "passengerId", pickup_address AS "pickupAddress"`,
    [leadMinutes],
  );
  return rows;
}

export async function findScheduledDue(leadMinutes, client = pool) {
  const { rows } = await client.query(
    `SELECT id, passenger_id AS "passengerId" FROM ride_requests
     WHERE status = 'pending' AND scheduled_for IS NOT NULL
       AND scheduled_for <= now() + ($1 * INTERVAL '1 minute')
     ORDER BY scheduled_for`,
    [leadMinutes],
  );
  return rows;
}

export async function findScheduledForUpdate(requestId, client) {
  const { rows } = await client.query(
    `SELECT id, public_id AS "publicId", passenger_id AS "passengerId", status,
            category_id AS "categoryId", women_only AS "womenOnly",
            pickup_lat::float8 AS "pickupLat", pickup_lng::float8 AS "pickupLng"
     FROM ride_requests WHERE id = $1 FOR UPDATE`,
    [requestId],
  );
  return rows[0];
}

// The search runs until a few minutes after the booked pickup time, never less than the usual window.
export async function startScheduledSearch(requestId, expiryMinutes, client) {
  await client.query(
    `UPDATE ride_requests
     SET status = 'searching',
         expires_at = GREATEST(scheduled_for, now()) + ($2 * INTERVAL '1 minute')
     WHERE id = $1`,
    [requestId, expiryMinutes],
  );
}

export async function findByPublicIdForUpdate(publicId, passengerId, client) {
  const { rows } = await client.query(
    `SELECT id, public_id AS "publicId", passenger_id AS "passengerId", status
     FROM ride_requests
     WHERE public_id = $1 AND passenger_id = $2
     FOR UPDATE`,
    [publicId, passengerId],
  );

  return rows[0];
}

export async function cancelSearching(requestId, client) {
  const { rows } = await client.query(
    `UPDATE ride_requests
     SET status = 'cancelled', cancelled_at = now()
     WHERE id = $1
     RETURNING public_id AS "publicId", status, cancelled_at AS "cancelledAt"`,
    [requestId],
  );

  return rows[0];
}

export async function markMatched(requestId, client) {
  await client.query(`UPDATE ride_requests SET status = 'matched' WHERE id = $1`, [requestId]);
}

export async function markCancelled(requestId, client) {
  await client.query(
    `UPDATE ride_requests SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
    [requestId],
  );
}

export async function hasActiveTrip(passengerId, client = pool) {
  const { rowCount } = await client.query(
    `SELECT 1 FROM trips
     WHERE passenger_id = $1 AND status IN ('assigned', 'arrived', 'in_progress')
     LIMIT 1`,
    [passengerId],
  );
  return rowCount > 0;
}

export async function expireStaleRequests(client = pool) {
  const { rows } = await client.query(
    `UPDATE ride_requests
     SET status = 'expired'
     WHERE status IN ('pending', 'searching')
       AND expires_at IS NOT NULL
       AND expires_at <= now()
     RETURNING id, public_id AS "publicId"`,
  );

  return rows;
}
