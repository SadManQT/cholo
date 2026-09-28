-- A trip starts only once both sides agree the rider is in the car. The driver slides "Start trip"
-- (start_requested_at) and the rider confirms (pickup_confirmed_at); whichever comes second starts it.
-- If the rider says the driver is not actually there, the arrival is undone (arrival_disputed_at) and
-- the driver has to arrive again, so a false "I'm here" can't start a ride or earn a no-show fee.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_requested_at TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS pickup_confirmed_at TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS arrival_disputed_at TIMESTAMPTZ;
