import { pool } from '../config/db.js';

export async function insertTrip({ requestId, passengerId, driverId, vehicleId }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO trips (request_id, passenger_id, driver_id, vehicle_id)
     VALUES ($1, $2, $3, $4)
     RETURNING id, trip_code AS "tripCode", status, assigned_at AS "assignedAt"`,
    [requestId, passengerId, driverId, vehicleId],
  );

  return rows[0];
}

// One query serves all three lifecycle transitions — arrived/start only
// need id+driverId+status, complete additionally needs the original
// request's pickup/dropoff/city/category for fare recomputation. FOR
// UPDATE OF t: lock only the trips row, not the joined ride_requests row.
export async function findByCodeForUpdate(tripCode, client) {
  const { rows } = await client.query(
    `SELECT t.id, t.trip_code AS "tripCode", t.driver_id AS "driverId",
            t.passenger_id AS "passengerId", t.request_id AS "requestId", t.status,
            t.assigned_at AS "assignedAt", t.arrived_at AS "arrivedAt",
            t.started_at AS "startedAt", t.completed_at AS "completedAt",
            rr.pickup_lat::float8 AS "pickupLat", rr.pickup_lng::float8 AS "pickupLng",
            rr.dropoff_lat::float8 AS "dropoffLat", rr.dropoff_lng::float8 AS "dropoffLng",
            rr.city_id AS "cityId", rr.category_id AS "categoryId"
     FROM trips t
     JOIN ride_requests rr ON rr.id = t.request_id
     WHERE t.trip_code = $1
     FOR UPDATE OF t`,
    [tripCode],
  );

  return rows[0];
}

export async function markArrived(tripId, client) {
  const { rows } = await client.query(
    `UPDATE trips SET status = 'arrived', arrived_at = now()
     WHERE id = $1
     RETURNING trip_code AS "tripCode", status, arrived_at AS "arrivedAt"`,
    [tripId],
  );

  return rows[0];
}

export async function markStarted(tripId, client) {
  const { rows } = await client.query(
    `UPDATE trips SET status = 'in_progress', started_at = now()
     WHERE id = $1
     RETURNING trip_code AS "tripCode", status, started_at AS "startedAt"`,
    [tripId],
  );

  return rows[0];
}

// sockets/rooms.js's connect-time membership check: "is this user currently
// on a trip?" — the DB round-trip that makes joining trip:{id} a real check,
// not a client-asserted claim. ORDER BY + LIMIT 1: a user can only ever be
// on one non-terminal trip at a time (dispatch/accept enforces that), this
// is just defensive against the impossible.
export async function findActiveTripIdForUser(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id FROM trips
     WHERE (driver_id = $1 OR passenger_id = $1)
       AND status IN ('assigned', 'arrived', 'in_progress')
     ORDER BY assigned_at DESC
     LIMIT 1`,
    [userId],
  );

  return rows[0]?.id;
}

// location.handler.js's ~4s GPS breadcrumb (schema.sql's own estimate for
// this partitioned, high-volume table).
export async function insertLocationPing(tripId, { lat, lng, heading, speedKmh }, client = pool) {
  await client.query(
    `INSERT INTO trip_location_pings (trip_id, lat, lng, heading, speed_kmh)
     VALUES ($1, $2, $3, $4, $5)`,
    [tripId, lat, lng, heading ?? null, speedKmh ?? null],
  );
}

export async function markCancelled(tripId, client) {
  const { rows } = await client.query(
    `UPDATE trips SET status = 'cancelled'
     WHERE id = $1
     RETURNING trip_code AS "tripCode", status`,
    [tripId],
  );

  return rows[0];
}

// trip_cancellations — weak 1:1 (doc 01 §13.9): one row per cancelled trip,
// holding the details that would otherwise be six always-NULL columns on
// every non-cancelled trip.
export async function insertCancellation(
  tripId,
  { cancelledByRole, cancelledBy, reasonCode, reasonText, feeCharged },
  client,
) {
  const { rows } = await client.query(
    `INSERT INTO trip_cancellations
       (trip_id, cancelled_by_role, cancelled_by, reason_code, reason_text, fee_charged)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING cancelled_at AS "cancelledAt", fee_charged AS "feeCharged"`,
    [tripId, cancelledByRole, cancelledBy, reasonCode, reasonText ?? null, feeCharged],
  );

  return rows[0];
}

// Fare fields deliberately NOT cast to float8 — doc 08-09-10 §10.3's worked
// example shows the completion response as fixed 2-decimal strings
// ("272.80"), which is NUMERIC(12,2)'s default pg-driver representation.
export async function completeTrip(tripId, { actualDistanceKm, actualDurationMin, fare }, client) {
  const { rows } = await client.query(
    `UPDATE trips SET
       status = 'completed', completed_at = now(),
       actual_distance_km = $2, actual_duration_min = $3,
       base_fare = $4, distance_fare = $5, time_fare = $6, waiting_fare = $7,
       surge_amount = $8, booking_fee = $9, discount_amount = $10, total_fare = $11
     WHERE id = $1
     RETURNING trip_code AS "tripCode", status, completed_at AS "completedAt",
               base_fare AS "baseFare", distance_fare AS "distanceFare", time_fare AS "timeFare",
               waiting_fare AS "waitingFare", surge_amount AS "surgeAmount",
               booking_fee AS "bookingFee", discount_amount AS "discountAmount",
               total_fare AS "totalFare", currency, payment_status AS "paymentStatus"`,
    [
      tripId, actualDistanceKm, actualDurationMin,
      fare.baseFare, fare.distanceFare, fare.timeFare, fare.waitingFare,
      fare.surgeAmount, fare.bookingFee, fare.discountAmount, fare.totalFare,
    ],
  );

  return rows[0];
}
