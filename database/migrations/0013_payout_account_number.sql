-- Finance has to send money to the real bKash/Nagad/bank number, but only a masked copy was ever stored.
-- The full number now lives in its own column, read only by the admin payout queue; every driver-facing
-- response keeps showing the masked value. Accounts added before this migration stay NULL (masked only).
ALTER TABLE driver_payout_accounts ADD COLUMN IF NOT EXISTS account_no VARCHAR(34);
