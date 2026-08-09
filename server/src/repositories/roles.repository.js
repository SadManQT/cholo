import { pool } from '../config/db.js';

export async function findIdByName(name) {
  const { rows } = await pool.query(
    `SELECT id FROM roles WHERE name = $1`,
    [name],
  );

  return rows[0]?.id;
}

export async function assignRole(userId, roleId) {
  await pool.query(
    `INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`,
    [userId, roleId],
  );
}

export async function findRoleNamesForUser(userId) {
  const { rows } = await pool.query(
    `SELECT r.name
     FROM user_roles ur
     JOIN roles r ON r.id = ur.role_id
     WHERE ur.user_id = $1`,
    [userId],
  );

  return rows.map((row) => row.name);
}
