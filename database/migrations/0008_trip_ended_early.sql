-- Trips a driver ended before the planned drop-off (the rider got out early). The rider is charged for the
-- route actually driven; the position is kept so admins can review it.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS ended_early_at TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_lat NUMERIC(9,6);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS end_lng NUMERIC(9,6);
CREATE INDEX IF NOT EXISTS idx_trips_ended_early ON trips (ended_early_at) WHERE ended_early_at IS NOT NULL;
