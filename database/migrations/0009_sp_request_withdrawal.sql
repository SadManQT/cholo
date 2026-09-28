-- sp_request_withdrawal — a driver cashes out. Three steps that must happen together:
--   1. lock the driver's wallet and check there is enough money,
--   2. record the withdrawal request,
--   3. take the money out of the wallet (a ledger debit; trg_apply_wallet_txn then updates wallets.balance).
-- It changes several tables in one workflow, so it is a procedure, called as
--   CALL sp_request_withdrawal(driver, payout_account, amount, fee, NULL)
-- inside the server's transaction (withTransaction in withdrawals.service.js), which COMMITs all of it or
-- ROLLs BACK all of it. The new withdrawal's id comes back through the INOUT parameter.
CREATE OR REPLACE PROCEDURE sp_request_withdrawal(
    p_driver_id         BIGINT,
    p_payout_account_id BIGINT,
    p_amount            NUMERIC(12,2),
    p_fee               NUMERIC(12,2),
    INOUT o_withdrawal_id BIGINT DEFAULT NULL
)
LANGUAGE plpgsql AS $$
DECLARE
    v_wallet_id BIGINT;
    v_balance   NUMERIC(12,2);
BEGIN
    -- FOR UPDATE: a second withdrawal for the same driver waits here, so two requests can't both spend
    -- the same balance.
    SELECT id, balance INTO v_wallet_id, v_balance
    FROM wallets
    WHERE user_id = p_driver_id
    FOR UPDATE;

    IF v_balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE';
    END IF;

    INSERT INTO withdrawals (driver_id, payout_account_id, amount, fee)
    VALUES (p_driver_id, p_payout_account_id, p_amount, p_fee)
    RETURNING id INTO o_withdrawal_id;

    INSERT INTO wallet_transactions
        (wallet_id, txn_type, direction, amount, reference_type, reference_id, idempotency_key)
    VALUES
        (v_wallet_id, 'withdrawal', 'debit', p_amount, 'withdrawal', o_withdrawal_id,
         'withdrawal-request-' || o_withdrawal_id);
END $$;
