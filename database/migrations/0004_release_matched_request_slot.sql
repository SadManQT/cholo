-- A matched request already has a trips row. Keeping it in the unique
-- "active request" predicate locked a passenger out forever after their
-- first completed trip because ride_request_status deliberately has no
-- duplicate "completed" state (the trip owns fulfillment state).
BEGIN;

DROP INDEX IF EXISTS ux_one_active_request_per_passenger;
CREATE UNIQUE INDEX ux_one_active_request_per_passenger
    ON ride_requests (passenger_id)
    WHERE status IN ('pending', 'searching') AND scheduled_for IS NULL;

COMMIT;
