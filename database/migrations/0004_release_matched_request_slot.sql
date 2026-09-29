BEGIN;

DROP INDEX IF EXISTS ux_one_active_request_per_passenger;
CREATE UNIQUE INDEX ux_one_active_request_per_passenger
    ON ride_requests (passenger_id)
    WHERE status IN ('pending', 'searching') AND scheduled_for IS NULL;

COMMIT;
