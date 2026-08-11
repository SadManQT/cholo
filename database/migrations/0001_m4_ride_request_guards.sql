-- Bring databases created before M4 up to the current schema.
-- Safe to run after schema.sql as well as against an older persistent volume.
BEGIN;

DROP FUNCTION IF EXISTS fn_current_pricing(SMALLINT, SMALLINT, TIMESTAMPTZ);

CREATE FUNCTION fn_current_pricing(
    p_city_id SMALLINT,
    p_category_id SMALLINT,
    p_at TIMESTAMPTZ DEFAULT now()
)
RETURNS SETOF pricing_rules AS $$
    SELECT *
    FROM pricing_rules
    WHERE city_id = p_city_id
      AND category_id = p_category_id
      AND is_active
      AND effective_from <= p_at
      AND (effective_to IS NULL OR effective_to > p_at)
    ORDER BY effective_from DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;

CREATE UNIQUE INDEX IF NOT EXISTS ux_one_active_request_per_passenger
    ON ride_requests (passenger_id)
    WHERE status IN ('pending', 'searching', 'matched') AND scheduled_for IS NULL;

COMMIT;
