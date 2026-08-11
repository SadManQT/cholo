import { pool } from '../config/db.js';

export async function findActive(client = pool) {
  const { rows } = await client.query(
    `SELECT id, name, description, seat_capacity AS "seatCapacity",
            icon_url AS "iconUrl", sort_order AS "sortOrder"
     FROM vehicle_categories
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`,
  );

  return rows;
}
