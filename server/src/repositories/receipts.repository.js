import { pool } from '../config/db.js';

// receipts — passenger-facing numbered financial document (schema.sql).
// receipt_no is minted by the column's own DEFAULT (seq_receipt_no, same
// 'JTR-YYYY-NNNNNN' pattern as trips.trip_code's seq_trip_code) — never
// generated in application code, so there is exactly one place a receipt
// number can come from.
export async function insert({ tripId, issuedTo, subtotal, discount, total }, client) {
  const { rows } = await client.query(
    `INSERT INTO receipts (trip_id, issued_to, subtotal, discount, total)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, receipt_no AS "receiptNo", issued_at AS "issuedAt"`,
    [tripId, issuedTo, subtotal, discount, total],
  );

  return rows[0];
}
