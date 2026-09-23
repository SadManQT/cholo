import { pool } from '../config/db.js';

export async function findEligibleDrivers({ categoryId, womenOnly }, client = pool) {
  const { rows } = await client.query(
    `SELECT da.driver_id AS "driverId",
            da.current_lat::float8 AS "currentLat",
            da.current_lng::float8 AS "currentLng"
     FROM driver_availability da
     JOIN driver_profiles dp ON dp.user_id = da.driver_id
     JOIN vehicles v ON v.id = dp.active_vehicle_id
     JOIN users u ON u.id = da.driver_id
     WHERE da.status = 'online'
       AND da.current_lat IS NOT NULL
       AND da.current_lng IS NOT NULL
       AND v.category_id = $1
       AND ($2 = false OR u.gender = 'female')`,
    [categoryId, womenOnly],
  );

  return rows;
}

export async function insertOffers(requestId, offers, client = pool) {
  const inserted = [];
  for (const offer of offers) {
    const { rows } = await client.query(
      `INSERT INTO ride_offers (request_id, driver_id, round, driver_distance_km)
       VALUES ($1, $2, 1, $3)
       ON CONFLICT (request_id, driver_id) DO NOTHING
       RETURNING id, driver_id AS "driverId"`,
      [requestId, offer.driverId, offer.distanceKm],
    );
    if (rows[0]) inserted.push(rows[0]);
  }

  return inserted;
}

export async function findPendingForDriver(driverId, offerTimeoutSeconds, client = pool) {
  const { rows } = await client.query(
    `SELECT
       ro.id, ro.request_id AS "requestId",
       ro.driver_distance_km::float8 AS "driverDistanceKm",
       ro.offered_at AS "offeredAt",
       ro.offered_at + ($2 * INTERVAL '1 second') AS "expiresAt",
       rr.public_id AS "requestPublicId",
       rr.pickup_address AS "pickupAddress", rr.dropoff_address AS "dropoffAddress",
       rr.est_fare::float8 AS "estFare", rr.est_distance_km::float8 AS "estDistanceKm",
       rr.est_duration_min AS "estDurationMin",
       vc.name AS "categoryName",
       pp.rating_avg AS "passengerRating"
     FROM ride_offers ro
     JOIN ride_requests rr ON rr.id = ro.request_id
     JOIN vehicle_categories vc ON vc.id = rr.category_id
     JOIN passenger_profiles pp ON pp.user_id = rr.passenger_id
     WHERE ro.driver_id = $1
       AND ro.response = 'pending'
       AND ro.offered_at + ($2 * INTERVAL '1 second') > now()
     ORDER BY ro.offered_at ASC`,
    [driverId, offerTimeoutSeconds],
  );

  return rows;
}

export async function findByIdForDriver(offerId, driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT ro.id, ro.request_id AS "requestId", ro.driver_id AS "driverId",
            rr.passenger_id AS "passengerId", ro.response, ro.offered_at AS "offeredAt"
     FROM ride_offers ro
     JOIN ride_requests rr ON rr.id = ro.request_id
     WHERE ro.id = $1 AND ro.driver_id = $2`,
    [offerId, driverId],
  );

  return rows[0];
}

export async function markResponse(offerId, response, client = pool) {
  const { rowCount } = await client.query(
    `UPDATE ride_offers SET response = $2, responded_at = now()
     WHERE id = $1 AND response = 'pending'`,
    [offerId, response],
  );

  return rowCount > 0;
}

export async function withdrawOtherOffersForRequest(requestId, exceptDriverId, client) {
  await client.query(
    `UPDATE ride_offers SET response = 'withdrawn', responded_at = now()
     WHERE request_id = $1 AND driver_id != $2 AND response = 'pending'`,
    [requestId, exceptDriverId],
  );
}

export async function withdrawOtherOffersForDriver(driverId, exceptOfferId, client) {
  await client.query(
    `UPDATE ride_offers SET response = 'withdrawn', responded_at = now()
     WHERE driver_id = $1 AND id != $2 AND response = 'pending'`,
    [driverId, exceptOfferId],
  );
}

export async function withdrawPendingOffersForRequests(requestIds, client = pool) {
  if (requestIds.length === 0) return;

  await client.query(
    `UPDATE ride_offers SET response = 'timed_out', responded_at = now()
     WHERE request_id = ANY($1::bigint[]) AND response = 'pending'`,
    [requestIds],
  );
}
