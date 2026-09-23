import { pool } from '../config/db.js';

export async function insert({ tripId, issuedTo, subtotal, discount, total }, client) {
  const { rows } = await client.query(
    `INSERT INTO receipts (trip_id, issued_to, subtotal, discount, total)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, receipt_no AS "receiptNo", issued_at AS "issuedAt"`,
    [tripId, issuedTo, subtotal, discount, total],
  );

  return rows[0];
}
