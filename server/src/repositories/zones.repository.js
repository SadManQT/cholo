import { pool } from '../config/db.js';

const ZONE_COLUMNS = `z.id, z.city_id AS "cityId", c.name AS "cityName", z.name, z.zone_type AS "zoneType",
  z.boundary_geojson AS boundary, z.is_active AS "isActive", z.created_at AS "createdAt", z.updated_at AS "updatedAt",
  (SELECT count(*)::int FROM driver_availability da WHERE da.current_zone_id = z.id AND da.status IN ('online', 'on_trip')) AS "activeDrivers"`;

export async function list({ cityId }, client = pool) {
  const { rows } = await client.query(
    `SELECT ${ZONE_COLUMNS} FROM zones z JOIN cities c ON c.id = z.city_id
     WHERE ($1::smallint IS NULL OR z.city_id = $1) ORDER BY c.name, z.name`,
    [cityId ?? null],
  );
  return rows;
}

export async function findForUpdate(id, client) {
  const { rows } = await client.query(
    `SELECT id, city_id AS "cityId", name, zone_type AS "zoneType", is_active AS "isActive"
     FROM zones WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return rows[0];
}

export async function insert({ cityId, name, zoneType, boundary, isActive }, client) {
  const { rows } = await client.query(
    `INSERT INTO zones (city_id, name, zone_type, boundary_geojson, is_active) VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [cityId, name, zoneType, boundary, isActive],
  );
  return rows[0].id;
}

export async function update(id, { name, zoneType, boundary, isActive }, client) {
  await client.query(
    `UPDATE zones SET name = COALESCE($2, name), zone_type = COALESCE($3, zone_type),
            boundary_geojson = COALESCE($4, boundary_geojson), is_active = COALESCE($5, is_active), updated_at = now()
     WHERE id = $1`,
    [id, name ?? null, zoneType ?? null, boundary ?? null, isActive ?? null],
  );
}

export async function remove(id, client) {
  await client.query(`UPDATE driver_availability SET current_zone_id = NULL WHERE current_zone_id = $1`, [id]);
  await client.query(`DELETE FROM zones WHERE id = $1`, [id]);
}

export async function findById(id, client = pool) {
  const { rows } = await client.query(`SELECT ${ZONE_COLUMNS} FROM zones z JOIN cities c ON c.id = z.city_id WHERE z.id = $1`, [id]);
  return rows[0];
}

/** Restricted zone names containing either point, if any. */
export async function findRestrictedAt(cityId, pickup, dropoff, client = pool) {
  const { rows } = await client.query(
    `SELECT name,
            fn_point_in_ring($2, $3, boundary_geojson -> 'coordinates' -> 0) AS "coversPickup"
     FROM zones
     WHERE is_active AND zone_type = 'restricted' AND city_id = $1 AND boundary_geojson IS NOT NULL
       AND (fn_point_in_ring($2, $3, boundary_geojson -> 'coordinates' -> 0)
            OR fn_point_in_ring($4, $5, boundary_geojson -> 'coordinates' -> 0))`,
    [cityId, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng],
  );
  return rows;
}
