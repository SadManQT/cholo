import { pool } from '../config/db.js';

const VEHICLE_SELECT = `
  v.id, v.driver_id AS "driverId", v.category_id AS "categoryId",
  vc.name AS "categoryName", v.registration_no AS "registrationNo",
  v.brand, v.model, v.model_year AS "modelYear", v.color,
  v.verification_status AS "verificationStatus", v.is_active AS "isActive",
  (dp.active_vehicle_id = v.id) AS "isOnDuty",
  v.created_at AS "createdAt", v.updated_at AS "updatedAt"`;

export async function findActiveCategory(categoryId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, name FROM vehicle_categories WHERE id = $1 AND is_active = true`,
    [categoryId],
  );

  return rows[0];
}

export async function insert(
  { driverId, categoryId, registrationNo, brand, model, modelYear, color },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO vehicles
       (driver_id, category_id, registration_no, brand, model, model_year, color)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [driverId, categoryId, registrationNo, brand ?? null, model ?? null, modelYear ?? null, color ?? null],
  );

  return rows[0].id;
}

export async function findByIdForDriver(vehicleId, driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${VEHICLE_SELECT}
     FROM vehicles v
     JOIN vehicle_categories vc ON vc.id = v.category_id
     JOIN driver_profiles dp ON dp.user_id = v.driver_id
     WHERE v.id = $1 AND v.driver_id = $2`,
    [vehicleId, driverId],
  );

  return rows[0];
}

export async function listForDriver(driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${VEHICLE_SELECT}
     FROM vehicles v
     JOIN vehicle_categories vc ON vc.id = v.category_id
     JOIN driver_profiles dp ON dp.user_id = v.driver_id
     WHERE v.driver_id = $1
     ORDER BY v.created_at DESC, v.id DESC`,
    [driverId],
  );

  return rows;
}

const EDITABLE_COLUMNS = Object.freeze({
  brand: 'brand',
  model: 'model',
  modelYear: 'model_year',
  color: 'color',
});

export async function update(vehicleId, driverId, fields, client = pool) {
  const entries = Object.entries(fields).filter(([key]) => key in EDITABLE_COLUMNS);
  const setClause = entries
    .map(([key], index) => `${EDITABLE_COLUMNS[key]} = $${index + 3}`)
    .join(', ');
  const values = entries.map(([, value]) => value);

  const { rowCount } = await client.query(
    `UPDATE vehicles SET ${setClause} WHERE id = $1 AND driver_id = $2`,
    [vehicleId, driverId, ...values],
  );

  return rowCount > 0;
}

export async function findForUpdate(vehicleId, client) {
  const { rows } = await client.query(
    `SELECT id, driver_id AS "driverId", category_id AS "categoryId",
            registration_no AS "registrationNo", brand, model,
            model_year AS "modelYear", color,
            verification_status AS "verificationStatus", is_active AS "isActive"
     FROM vehicles
     WHERE id = $1
     FOR UPDATE`,
    [vehicleId],
  );

  return rows[0];
}

export async function activate(vehicleId, driverId, client = pool) {
  await client.query(
    `UPDATE driver_profiles SET active_vehicle_id = $2 WHERE user_id = $1`,
    [driverId, vehicleId],
  );
}

export async function deactivate(vehicleId, driverId, client = pool) {
  const { rowCount } = await client.query(
    `UPDATE vehicles SET is_active = false WHERE id = $1 AND driver_id = $2`,
    [vehicleId, driverId],
  );

  if (rowCount > 0) {
    await client.query(
      `UPDATE driver_profiles SET active_vehicle_id = NULL
       WHERE user_id = $1 AND active_vehicle_id = $2`,
      [driverId, vehicleId],
    );
    await client.query(
      `UPDATE driver_availability SET status = 'offline'
       WHERE driver_id = $1 AND status IN ('online', 'break')`,
      [driverId],
    );
  }

  return rowCount > 0;
}

export async function resetRejectedToPending(vehicleId, client = pool) {
  await client.query(
    `UPDATE vehicles SET verification_status = 'pending'
     WHERE id = $1 AND verification_status = 'rejected'`,
    [vehicleId],
  );
}

export async function setVerificationStatus(vehicleId, status, client = pool) {
  const { rows } = await client.query(
    `UPDATE vehicles SET verification_status = $2 WHERE id = $1
     RETURNING id, driver_id AS "driverId", category_id AS "categoryId",
               registration_no AS "registrationNo", brand, model,
               model_year AS "modelYear", color,
               verification_status AS "verificationStatus", is_active AS "isActive"`,
    [vehicleId, status],
  );

  return rows[0];
}
