-- sp_request_withdrawal (0009) now also refuses a frozen wallet: freezing a wallet has to stop money
-- leaving it, not only trip payments and top-ups. Same signature, so the server call is unchanged.
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
    v_status    wallet_status;
BEGIN
    -- FOR UPDATE: a second withdrawal for the same driver waits here, so two requests can't both spend
    -- the same balance.
    SELECT id, balance, status INTO v_wallet_id, v_balance, v_status
    FROM wallets
    WHERE user_id = p_driver_id
    FOR UPDATE;

    IF v_status <> 'active' THEN
        RAISE EXCEPTION 'WALLET_FROZEN';
    END IF;

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
