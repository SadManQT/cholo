import { pool } from '../config/db.js';

export async function insertRequest(
  {
    passengerId, cityId, categoryId, pickup, dropoff,
    estDistanceKm, estDurationMin, estFare, surgeMultiplier,
    paymentIntent, promoCodeId, womenOnly, scheduledFor, expiryMinutes,
  },
  client = pool,
) {
  // expires_at is computed in the SAME now() as the requested_at DEFAULT,
  // in one statement — not `Date.now() + 5min` in JS, which would drift
  // from the DB's own clock/network latency and make the two timestamps
  // not exactly 5 minutes apart.
  const { rows } = await client.query(
    `INSERT INTO ride_requests
       (passenger_id, city_id, category_id,
        pickup_lat, pickup_lng, pickup_address,
        dropoff_lat, dropoff_lng, dropoff_address,
        est_distance_km, est_duration_min, est_fare, surge_multiplier,
        payment_intent, promo_code_id, women_only, scheduled_for,
        status, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
             'searching', now() + ($18 * INTERVAL '1 minute'))
     RETURNING id, public_id AS "publicId", status,
               requested_at AS "requestedAt", expires_at AS "expiresAt"`,
    [
      passengerId, cityId, categoryId,
      pickup.lat, pickup.lng, pickup.address ?? null,
      dropoff.lat, dropoff.lng, dropoff.address ?? null,
      estDistanceKm, estDurationMin, estFare, surgeMultiplier,
      paymentIntent, promoCodeId ?? null, womenOnly, scheduledFor ?? null,
      expiryMinutes,
    ],
  );

  return rows[0];
}

// The T1 row lock (doc 02-03 §8): whoever gets here first holds this row
// until COMMIT/ROLLBACK; the second concurrent caller blocks right here,
// not at the INSERT — that's what makes the race impossible, not just handled.
export async function findForUpdate(requestId, client) {
  const { rows } = await client.query(
    `SELECT id, passenger_id AS "passengerId", status,
            pickup_lat::float8 AS "pickupLat", pickup_lng::float8 AS "pickupLng",
            pickup_address AS "pickupAddress"
     FROM ride_requests
     WHERE id = $1
     FOR UPDATE`,
    [requestId],
  );

  return rows[0];
}

export async function findByPublicIdForPassenger(publicId, passengerId, client = pool) {
  const { rows } = await client.query(
    `SELECT rr.id, rr.public_id AS "publicId", rr.passenger_id AS "passengerId",
            rr.status, rr.pickup_lat::float8 AS "pickupLat",
            rr.pickup_lng::float8 AS "pickupLng", rr.pickup_address AS "pickupAddress",
            rr.dropoff_lat::float8 AS "dropoffLat",
            rr.dropoff_lng::float8 AS "dropoffLng", rr.dropoff_address AS "dropoffAddress",
            rr.est_distance_km::float8 AS "estDistanceKm",
            rr.est_duration_min AS "estDurationMin", rr.est_fare AS "estFare",
            rr.surge_multiplier AS "surgeMultiplier", rr.payment_intent AS "paymentIntent",
            rr.requested_at AS "requestedAt", rr.expires_at AS "expiresAt",
            rr.cancelled_at AS "cancelledAt", t.trip_code AS "tripCode"
     FROM ride_requests rr
     LEFT JOIN trips t ON t.request_id = rr.id
     WHERE rr.public_id = $1 AND rr.passenger_id = $2`,
    [publicId, passengerId],
  );

  return rows[0];
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

// Reuses cancelled_at (doc 04 documents it for the searching-stage cancel,
// but it's the request's only "stopped being active" timestamp — a
// post-match trip cancellation is the same phenomenon from the request's
// point of view, not a second thing worth a new column) — WITHOUT this,
// ux_one_active_request_per_passenger (schema.sql) would keep counting a
// 'matched' request as the passenger's one active slot forever, since
// nothing else ever moves it out of that status once its trip is cancelled.
export async function markCancelled(requestId, client) {
  await client.query(
    `UPDATE ride_requests SET status = 'cancelled', cancelled_at = now() WHERE id = $1`,
    [requestId],
  );
}

// jobs/expireRequests.job.js's sweep. No FOR UPDATE needed: a plain UPDATE
// already takes its own row lock and re-checks WHERE after acquiring it, so
// a request mid-accept (dispatch.service.js's FOR UPDATE) simply blocks this
// statement until that transaction resolves, then this WHERE clause
// correctly no longer matches it if it became 'matched'.
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
