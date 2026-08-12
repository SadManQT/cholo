import { pool } from '../config/db.js';

// driver_payout_accounts — bKash/Nagad/bank destinations; the raw account
// number is never stored, only its mask (schema.sql's own comment).
// is_verified defaults true here — there's no real verification check to
// perform (no bank/mobile-money account-ownership API integrated), so
// leaving every account permanently 'false' would just make withdrawals
// permanently impossible. The is_verified column and the check against it
// (withdrawals.service.js) stay real, in case that verification step gets
// built later.
export async function insert({ driverId, accountType, accountName, accountNoMasked, bankName }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO driver_payout_accounts (driver_id, account_type, account_name, account_no_masked, bank_name, is_verified)
     VALUES ($1, $2, $3, $4, $5, true)
     RETURNING id, account_type AS "accountType", account_name AS "accountName",
               account_no_masked AS "accountNoMasked", bank_name AS "bankName",
               is_default AS "isDefault", is_verified AS "isVerified", created_at AS "createdAt"`,
    [driverId, accountType, accountName, accountNoMasked, bankName ?? null],
  );

  return rows[0];
}

export async function listForDriver(driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, account_type AS "accountType", account_name AS "accountName",
            account_no_masked AS "accountNoMasked", bank_name AS "bankName",
            is_default AS "isDefault", is_verified AS "isVerified", created_at AS "createdAt"
     FROM driver_payout_accounts
     WHERE driver_id = $1
     ORDER BY created_at DESC`,
    [driverId],
  );

  return rows;
}

export async function findByIdForDriver(accountId, driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT id, driver_id AS "driverId", account_type AS "accountType", account_name AS "accountName",
            account_no_masked AS "accountNoMasked", bank_name AS "bankName",
            is_default AS "isDefault", is_verified AS "isVerified"
     FROM driver_payout_accounts
     WHERE id = $1 AND driver_id = $2`,
    [accountId, driverId],
  );

  return rows[0];
}

// withdrawals.payout_account_id is ON DELETE RESTRICT (schema.sql) — the
// DB would refuse the DELETE anyway, but only with a generic 23503
// foreign_key_violation (mapped to a vague 422, not doc 09 §8's specific
// "409 pending withdrawal uses it"). Checked here first so the caller
// gets an honest, specific reason.
export async function countWithdrawalsForAccount(accountId, client = pool) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n FROM withdrawals WHERE payout_account_id = $1`,
    [accountId],
  );

  return rows[0].n;
}

export async function remove(accountId, driverId, client = pool) {
  const { rowCount } = await client.query(
    `DELETE FROM driver_payout_accounts WHERE id = $1 AND driver_id = $2`,
    [accountId, driverId],
  );

  return rowCount > 0;
}
