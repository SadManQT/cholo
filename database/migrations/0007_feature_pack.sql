-- Feature pack: extra stops, scheduled-ride reminders, admin two-step login, referral codes,
-- and indexes for surge / reports / scheduled dispatch. Idempotent like 0005.

-- Up to two intermediate stops chosen at booking: [{"lat":..,"lng":..,"address":..}, ...].
-- Copied into trip_stops when a driver accepts.
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS stops JSONB;
ALTER TABLE ride_requests ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_ride_requests_scheduled_pending
    ON ride_requests (scheduled_for) WHERE status = 'pending' AND scheduled_for IS NOT NULL;

-- TOTP (authenticator app) second factor for admins. The secret is base32; enabled_at marks a
-- confirmed setup. A secret without enabled_at is a setup in progress.
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS totp_secret VARCHAR(64);
ALTER TABLE admin_profiles ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;

-- Every user gets a shareable referral code; new users get one at sign-up.
UPDATE users
SET referral_code = upper(substr(replace(public_id::text, '-', ''), 1, 8))
WHERE referral_code IS NULL;

CREATE INDEX IF NOT EXISTS idx_surge_pricing_zone_active ON surge_pricing (zone_id, starts_at) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_user_reports_status ON user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported ON user_reports (reported_id);
CREATE INDEX IF NOT EXISTS idx_invoices_driver ON invoices (driver_id, period_start DESC);

-- Deleted accounts give their phone number back so the owner can sign up again later; the row keeps
-- trips and payments for accounting with the phone replaced by "deleted-<id>".
ALTER TABLE users DROP CONSTRAINT IF EXISTS chk_users_phone_format;
ALTER TABLE users ADD CONSTRAINT chk_users_phone_format
    CHECK (phone ~ '^01[3-9][0-9]{8}$' OR (status = 'deleted' AND phone ~ '^deleted-[0-9]+$'));
