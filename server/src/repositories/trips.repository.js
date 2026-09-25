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

const TRIP_FOR_UPDATE_COLUMNS = `
  t.id, t.trip_code AS "tripCode", t.driver_id AS "driverId",
  t.passenger_id AS "passengerId", t.request_id AS "requestId", t.status,
  t.assigned_at AS "assignedAt", t.arrived_at AS "arrivedAt",
  t.started_at AS "startedAt", t.completed_at AS "completedAt",
  t.total_fare AS "totalFare", t.payment_status AS "paymentStatus",
  rr.pickup_lat::float8 AS "pickupLat", rr.pickup_lng::float8 AS "pickupLng",
  rr.dropoff_lat::float8 AS "dropoffLat", rr.dropoff_lng::float8 AS "dropoffLng",
  rr.city_id AS "cityId", rr.category_id AS "categoryId",
  rr.payment_intent AS "paymentIntent", rr.promo_code_id AS "promoCodeId",
  rr.surge_multiplier::float8 AS "surgeMultiplier", rr.stops
`;

export async function findByCodeForUpdate(tripCode, client) {
  const { rows } = await client.query(
    `SELECT ${TRIP_FOR_UPDATE_COLUMNS}
     FROM trips t
     JOIN ride_requests rr ON rr.id = t.request_id
     WHERE t.trip_code = $1
     FOR UPDATE OF t`,
    [tripCode],
  );

  return rows[0];
}

export async function findByIdForUpdate(tripId, client) {
  const { rows } = await client.query(
    `SELECT ${TRIP_FOR_UPDATE_COLUMNS}
     FROM trips t
     JOIN ride_requests rr ON rr.id = t.request_id
     WHERE t.id = $1
     FOR UPDATE OF t`,
    [tripId],
  );

  return rows[0];
}

export async function hasCompletedTrip(passengerId, client = pool) {
  const { rows } = await client.query(
    `SELECT EXISTS(
       SELECT 1 FROM trips WHERE passenger_id = $1 AND status = 'completed'
     ) AS "exists"`,
    [passengerId],
  );

  return rows[0].exists;
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

export async function listForUser(userId, { page, limit, status, role }, client = pool) {
  const offset = (page - 1) * limit;
  const { rows } = await client.query(
    `SELECT t.trip_code AS "publicCode", t.status,
            CASE WHEN t.passenger_id = $1 THEN 'passenger' ELSE 'driver' END AS "participantRole",
            rr.pickup_address AS "pickupAddress", rr.dropoff_address AS "dropoffAddress",
            rr.est_fare AS "estFare", t.total_fare AS "totalFare", t.currency,
            vc.name AS "categoryName",
            CASE WHEN t.passenger_id = $1 THEN du.full_name ELSE pu.full_name END AS "counterpartyName",
            t.assigned_at AS "assignedAt", t.completed_at AS "completedAt",
            count(*) OVER()::int AS "totalCount"
     FROM trips t
     JOIN ride_requests rr ON rr.id = t.request_id
     JOIN vehicle_categories vc ON vc.id = rr.category_id
     JOIN users pu ON pu.id = t.passenger_id
     JOIN users du ON du.id = t.driver_id
     WHERE (t.passenger_id = $1 OR t.driver_id = $1)
       AND (
         $5::text IS NULL
         OR ($5 = 'passenger' AND t.passenger_id = $1)
         OR ($5 = 'driver' AND t.driver_id = $1)
       )
       AND (
         $2::text IS NULL
         OR ($2 = 'active' AND t.status IN ('assigned', 'arrived', 'in_progress'))
         OR t.status::text = $2
       )
     ORDER BY t.created_at DESC
     LIMIT $3 OFFSET $4`,
    [userId, status ?? null, limit, offset, role ?? null],
  );

  return rows;
}

export async function findDetailForUser(tripCode, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT t.id, t.trip_code AS "publicCode", t.status,
            CASE WHEN t.passenger_id = $2 THEN 'passenger' ELSE 'driver' END AS "participantRole",
            rr.public_id AS "requestPublicId", rr.pickup_lat::float8 AS "pickupLat",
            rr.pickup_lng::float8 AS "pickupLng", rr.pickup_address AS "pickupAddress",
            rr.dropoff_lat::float8 AS "dropoffLat", rr.dropoff_lng::float8 AS "dropoffLng",
            rr.dropoff_address AS "dropoffAddress", rr.est_distance_km::float8 AS "estDistanceKm",
            rr.est_duration_min AS "estDurationMin", rr.est_fare AS "estFare",
            rr.surge_multiplier AS "surgeMultiplier", rr.payment_intent AS "paymentIntent",
            c.name AS "cityName", vc.name AS "categoryName",
            pu.public_id AS "passengerPublicId", pu.full_name AS "passengerName",
            pu.phone AS "passengerPhone", pu.photo_url AS "passengerPhotoUrl",
            pp.rating_avg AS "passengerRating",
            du.public_id AS "driverPublicId", du.full_name AS "driverName",
            du.phone AS "driverPhone", du.photo_url AS "driverPhotoUrl",
            dp.rating_avg AS "driverRating",
            v.registration_no AS "vehicleRegistrationNo", v.brand AS "vehicleBrand",
            v.model AS "vehicleModel", v.color AS "vehicleColor",
            t.assigned_at AS "assignedAt", t.arrived_at AS "arrivedAt",
            t.started_at AS "startedAt", t.completed_at AS "completedAt",
            t.actual_distance_km::float8 AS "actualDistanceKm",
            t.actual_duration_min AS "actualDurationMin",
            t.base_fare AS "baseFare", t.distance_fare AS "distanceFare",
            t.time_fare AS "timeFare", t.waiting_fare AS "waitingFare",
            t.surge_amount AS "surgeAmount", t.booking_fee AS "bookingFee",
            t.discount_amount AS "discountAmount", t.total_fare AS "totalFare",
            t.currency, t.payment_status AS "paymentStatus",
            tc.cancelled_by_role AS "cancelledByRole", tc.reason_code AS "cancellationReasonCode",
            tc.reason_text AS "cancellationReasonText", tc.fee_charged AS "cancellationFee",
            tc.cancelled_at AS "cancelledAt",
            r.receipt_no AS "receiptNo", r.issued_at AS "receiptIssuedAt",
            (SELECT jsonb_build_object('score', rt.score, 'comment', rt.comment)
             FROM ratings rt WHERE rt.trip_id = t.id AND rt.rater_id = $2) AS "myRating",
            (SELECT COALESCE(jsonb_agg(jsonb_build_object(
                      'order', ts.stop_order, 'lat', ts.lat::float8, 'lng', ts.lng::float8,
                      'address', ts.address_text, 'arrivedAt', ts.arrived_at) ORDER BY ts.stop_order), '[]'::jsonb)
             FROM trip_stops ts WHERE ts.trip_id = t.id) AS stops,
            EXISTS (SELECT 1 FROM favorite_drivers fd
                    WHERE fd.passenger_id = $2 AND fd.driver_id = t.driver_id) AS "driverIsFavorite",
            EXISTS (SELECT 1 FROM user_reports ur
                    WHERE ur.trip_id = t.id AND ur.reporter_id = $2) AS "reportedByMe"
     FROM trips t
     JOIN ride_requests rr ON rr.id = t.request_id
     JOIN cities c ON c.id = rr.city_id
     JOIN vehicle_categories vc ON vc.id = rr.category_id
     JOIN users pu ON pu.id = t.passenger_id
     JOIN passenger_profiles pp ON pp.user_id = t.passenger_id
     JOIN users du ON du.id = t.driver_id
     JOIN driver_profiles dp ON dp.user_id = t.driver_id
     JOIN vehicles v ON v.id = t.vehicle_id
     LEFT JOIN trip_cancellations tc ON tc.trip_id = t.id
     LEFT JOIN receipts r ON r.trip_id = t.id
     WHERE t.trip_code = $1 AND (t.passenger_id = $2 OR t.driver_id = $2)`,
    [tripCode, userId],
  );

  return rows[0];
}

export async function listStatusHistory(tripId, client = pool) {
  const { rows } = await client.query(
    `SELECT from_status AS "fromStatus", to_status AS "toStatus",
            note, changed_at AS "changedAt"
     FROM trip_status_history
     WHERE trip_id = $1
     ORDER BY changed_at ASC, id ASC`,
    [tripId],
  );

  return rows;
}

export async function findLatestLocationForUser(tripCode, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT COALESCE(p.lat, da.current_lat)::float8 AS lat,
            COALESCE(p.lng, da.current_lng)::float8 AS lng,
            COALESCE(p.heading, da.heading)::float8 AS heading,
            COALESCE(p.recorded_at, da.last_ping_at) AS at
     FROM trips t
     JOIN driver_availability da ON da.driver_id = t.driver_id
     LEFT JOIN LATERAL (
       SELECT lat, lng, heading, recorded_at
       FROM trip_location_pings
       WHERE trip_id = t.id
       ORDER BY recorded_at DESC
       LIMIT 1
     ) p ON true
     WHERE t.trip_code = $1 AND (t.passenger_id = $2 OR t.driver_id = $2)`,
    [tripCode, userId],
  );

  return rows[0];
}

export async function findParticipantTrip(tripCode, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, trip_code AS "tripCode", passenger_id AS "passengerId",
            driver_id AS "driverId", status
     FROM trips
     WHERE trip_code = $1 AND (passenger_id = $2 OR driver_id = $2)`,
    [tripCode, userId],
  );

  return rows[0];
}

export async function listMessages(tripId, client = pool) {
  const { rows } = await client.query(
    `SELECT tm.id, u.public_id AS "senderId", u.full_name AS "senderName",
            u.photo_url AS "senderPhotoUrl", tm.message_type AS "messageType",
            tm.body, tm.sent_at AS "sentAt", tm.read_at AS "readAt"
     FROM trip_messages tm
     JOIN users u ON u.id = tm.sender_id
     WHERE tm.trip_id = $1
     ORDER BY tm.sent_at ASC, tm.id ASC
     LIMIT 100`,
    [tripId],
  );

  return rows;
}

export async function insertMessage(tripId, senderId, { body, messageType }, client = pool) {
  const { rows } = await client.query(
    `WITH inserted AS (
       INSERT INTO trip_messages (trip_id, sender_id, message_type, body)
       VALUES ($1, $2, $3, $4)
       RETURNING id, sender_id, message_type, body, sent_at, read_at
     )
     SELECT i.id, u.public_id AS "senderId", u.full_name AS "senderName",
            u.photo_url AS "senderPhotoUrl", i.message_type AS "messageType",
            i.body, i.sent_at AS "sentAt", i.read_at AS "readAt"
     FROM inserted i
     JOIN users u ON u.id = i.sender_id`,
    [tripId, senderId, messageType, body],
  );

  return rows[0];
}

export async function insertSosAlert(tripId, userId, { lat, lng }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO sos_alerts (trip_id, triggered_by, lat, lng)
     VALUES ($1, $2, $3, $4)
     RETURNING id, status, lat::float8 AS lat, lng::float8 AS lng,
               triggered_at AS "triggeredAt"`,
    [tripId, userId, lat, lng],
  );

  return rows[0];
}

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

export async function completeTrip(
  tripId,
  { actualDistanceKm, actualDurationMin, fare, paymentStatus = 'unpaid' },
  client,
) {
  const { rows } = await client.query(
    `UPDATE trips SET
       status = 'completed', completed_at = now(),
       actual_distance_km = $2, actual_duration_min = $3,
       base_fare = $4, distance_fare = $5, time_fare = $6, waiting_fare = $7,
       surge_amount = $8, booking_fee = $9, discount_amount = $10, total_fare = $11,
       payment_status = $12
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
      paymentStatus,
    ],
  );

  return rows[0];
}

export async function markPaid(tripId, client) {
  const { rows } = await client.query(
    `UPDATE trips SET payment_status = 'paid' WHERE id = $1
     RETURNING trip_code AS "tripCode", payment_status AS "paymentStatus"`,
    [tripId],
  );

  return rows[0];
}

export async function insertStops(tripId, stops, client) {
  for (const [index, stop] of stops.entries()) {
    await client.query(
      `INSERT INTO trip_stops (trip_id, stop_order, lat, lng, address_text) VALUES ($1, $2, $3, $4, $5)`,
      [tripId, index + 1, stop.lat, stop.lng, stop.address ?? null],
    );
  }
}

export async function markStopArrived(tripId, stopOrder, client) {
  const { rows } = await client.query(
    `UPDATE trip_stops SET arrived_at = now()
     WHERE trip_id = $1 AND stop_order = $2 AND arrived_at IS NULL
     RETURNING stop_order AS "order", arrived_at AS "arrivedAt"`,
    [tripId, stopOrder],
  );
  return rows[0];
}

// What a family member sees through a share link: no phone numbers, no passenger details.
export async function findSharedView(tripId, client = pool) {
  const { rows } = await client.query(
    `SELECT t.trip_code AS "tripCode", t.status, t.assigned_at AS "assignedAt",
            t.started_at AS "startedAt", t.completed_at AS "completedAt",
            GREATEST(t.completed_at, tc.cancelled_at) AS "endedAt",
            split_part(du.full_name, ' ', 1) AS "driverFirstName", du.photo_url AS "driverPhotoUrl",
            dp.rating_avg AS "driverRating",
            v.registration_no AS "registrationNo", v.brand, v.model, v.color,
            rr.pickup_address AS "pickupAddress", rr.dropoff_address AS "dropoffAddress",
            rr.pickup_lat::float8 AS "pickupLat", rr.pickup_lng::float8 AS "pickupLng",
            rr.dropoff_lat::float8 AS "dropoffLat", rr.dropoff_lng::float8 AS "dropoffLng",
            loc.lat, loc.lng, loc.at AS "locationAt"
     FROM trips t
     JOIN ride_requests rr ON rr.id = t.request_id
     JOIN users du ON du.id = t.driver_id
     JOIN driver_profiles dp ON dp.user_id = t.driver_id
     JOIN vehicles v ON v.id = t.vehicle_id
     JOIN driver_availability da ON da.driver_id = t.driver_id
     LEFT JOIN trip_cancellations tc ON tc.trip_id = t.id
     LEFT JOIN LATERAL (
       SELECT COALESCE(p.lat, da.current_lat)::float8 AS lat, COALESCE(p.lng, da.current_lng)::float8 AS lng,
              COALESCE(p.recorded_at, da.last_ping_at) AS at
       FROM (SELECT 1) one
       LEFT JOIN LATERAL (SELECT lat, lng, recorded_at FROM trip_location_pings
                          WHERE trip_id = t.id ORDER BY recorded_at DESC LIMIT 1) p ON true
     ) loc ON t.status IN ('assigned', 'arrived', 'in_progress')
     WHERE t.id = $1`,
    [tripId],
  );
  return rows[0];
}
