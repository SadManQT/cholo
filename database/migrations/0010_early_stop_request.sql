-- The rider asks to get out before the drop-off ("Stop here"). Only after that may the driver end the trip
-- away from the drop-off, so a driver can't cut a trip short on their own and charge for less than the ride.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS early_stop_requested_at TIMESTAMPTZ;
