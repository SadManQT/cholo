import { pool } from '../config/db.js';

export async function findApplicationState(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT u.phone_verified_at AS "phoneVerifiedAt",
            dp.user_id AS "driverId"
     FROM users u
     LEFT JOIN driver_profiles dp ON dp.user_id = u.id
     WHERE u.id = $1`,
    [userId],
  );

  return rows[0];
}

export async function insertProfile(
  { userId, nidNumber, licenseNumber, licenseExpiry },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO driver_profiles
       (user_id, nid_number, license_number, license_expiry)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id AS "userId", nid_number AS "nidNumber",
               license_number AS "licenseNumber",
               license_expiry::text AS "licenseExpiry",
               verification_status AS "verificationStatus",
               created_at AS "createdAt"`,
    [userId, nidNumber, licenseNumber, licenseExpiry],
  );

  return rows[0];
}

export async function findStatusByUserId(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT dp.user_id AS "userId", dp.nid_number AS "nidNumber",
            dp.license_number AS "licenseNumber",
            dp.license_expiry::text AS "licenseExpiry",
            dp.verification_status AS "verificationStatus",
            dp.verified_by AS "verifiedBy", dp.verified_at AS "verifiedAt",
            dp.created_at AS "createdAt", dp.updated_at AS "updatedAt",
            da.status AS "availabilityStatus", da.current_lat AS "currentLat",
            da.current_lng AS "currentLng", da.heading,
            da.last_ping_at AS "lastPingAt",
            v.id AS "activeVehicleId", v.registration_no AS "activeVehicleRegistrationNo",
            v.verification_status AS "activeVehicleVerificationStatus"
     FROM driver_profiles dp
     JOIN driver_availability da ON da.driver_id = dp.user_id
     LEFT JOIN vehicles v ON v.id = dp.active_vehicle_id
     WHERE dp.user_id = $1`,
    [userId],
  );

  return rows[0];
}

export async function findProfileForUpdate(userId, client) {
  const { rows } = await client.query(
    `SELECT user_id AS "userId", nid_number AS "nidNumber",
            license_number AS "licenseNumber", license_expiry::text AS "licenseExpiry",
            verification_status AS "verificationStatus",
            verified_by AS "verifiedBy", verified_at AS "verifiedAt",
            active_vehicle_id AS "activeVehicleId"
     FROM driver_profiles
     WHERE user_id = $1
     FOR UPDATE`,
    [userId],
  );

  return rows[0];
}

export async function setVerificationStatus(
  userId,
  { status, verifiedBy },
  client = pool,
) {
  const { rows } = await client.query(
    `UPDATE driver_profiles
     SET verification_status = $2,
         verified_by = $3,
         verified_at = now()
     WHERE user_id = $1
     RETURNING user_id AS "userId", nid_number AS "nidNumber",
               license_number AS "licenseNumber",
               license_expiry::text AS "licenseExpiry",
               verification_status AS "verificationStatus",
               verified_by AS "verifiedBy", verified_at AS "verifiedAt"`,
    [userId, status, verifiedBy],
  );

  return rows[0];
}

export async function resetRejectedToPending(userId, client = pool) {
  await client.query(
    `UPDATE driver_profiles
     SET verification_status = 'pending', verified_by = NULL, verified_at = NULL
     WHERE user_id = $1 AND verification_status = 'rejected'`,
    [userId],
  );
}

export async function findAvailabilityForUpdate(userId, client) {
  const { rows } = await client.query(
    `SELECT da.driver_id AS "driverId", da.status,
            da.current_lat AS "currentLat", da.current_lng AS "currentLng",
            dp.verification_status AS "driverVerificationStatus",
            dp.active_vehicle_id AS "activeVehicleId",
            v.verification_status AS "vehicleVerificationStatus",
            v.is_active AS "vehicleIsActive"
     FROM driver_availability da
     JOIN driver_profiles dp ON dp.user_id = da.driver_id
     LEFT JOIN vehicles v ON v.id = dp.active_vehicle_id
     WHERE da.driver_id = $1
     FOR UPDATE OF da, dp`,
    [userId],
  );

  return rows[0];
}

export async function updateAvailability(
  userId,
  { status, currentLat, currentLng, heading },
  client = pool,
) {
  const hasLocation = currentLat !== undefined && currentLng !== undefined;
  const { rows } = await client.query(
    `UPDATE driver_availability
     SET status = $2,
         current_lat = CASE WHEN $3::boolean THEN $4 ELSE current_lat END,
         current_lng = CASE WHEN $3::boolean THEN $5 ELSE current_lng END,
         heading = CASE WHEN $6::boolean THEN $7 ELSE heading END,
         last_ping_at = CASE WHEN $3::boolean THEN now() ELSE last_ping_at END
     WHERE driver_id = $1
     RETURNING status, current_lat AS "currentLat", current_lng AS "currentLng",
               heading, current_zone_id AS "currentZoneId",
               last_ping_at AS "lastPingAt", updated_at AS "updatedAt"`,
    [
      userId,
      status,
      hasLocation,
      currentLat ?? null,
      currentLng ?? null,
      heading !== undefined,
      heading ?? null,
    ],
  );

  return rows[0];
}
