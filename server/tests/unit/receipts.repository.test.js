import assert from 'node:assert/strict';
import { after, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { insert } from '../../src/repositories/receipts.repository.js';

after(async () => {
  await pool.end();
});

test('insert writes trip_id/issued_to/subtotal/discount/total and returns the minted receipt_no', async () => {
  const client = { query: async (sql, values) => {
    assert.match(sql, /INSERT INTO receipts/);
    assert.match(sql, /RETURNING id, receipt_no AS "receiptNo", issued_at AS "issuedAt"/);
    assert.deepEqual(values, [99, 42, 437.80, 50, 387.80]);
    return { rows: [{ id: 1, receiptNo: 'JTR-2026-000001', issuedAt: new Date('2026-01-01T00:00:00Z') }] };
  } };

  const receipt = await insert(
    { tripId: 99, issuedTo: 42, subtotal: 437.80, discount: 50, total: 387.80 },
    client,
  );

  assert.match(receipt.receiptNo, /^JTR-\d{4}-\d{6}$/);
});
