-- Launch features: timed suspensions, dispute review timestamps, notification inbox index.
-- Idempotent so db-init can run it against both fresh and existing databases.

ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason VARCHAR(255);

ALTER TABLE disputes ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_suspended_until ON users (suspended_until) WHERE status = 'suspended';

-- Rejections must tell the driver why; until now only the audit log kept the reason.
ALTER TABLE vehicle_documents ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR(255);

-- Zones: boundary_geojson holds a GeoJSON Polygon ({"type":"Polygon","coordinates":[[[lng,lat],...]]}).
-- Ray-casting point-in-polygon in SQL so every query that stores a position can tag its zone inline.
CREATE OR REPLACE FUNCTION fn_point_in_ring(p_lat NUMERIC, p_lng NUMERIC, p_ring JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
    inside BOOLEAN := false;
    n INT := COALESCE(jsonb_array_length(p_ring), 0);
    i INT;
    j INT;
    xi FLOAT8; yi FLOAT8; xj FLOAT8; yj FLOAT8;
BEGIN
    IF n < 3 OR p_lat IS NULL OR p_lng IS NULL THEN RETURN false; END IF;
    j := n - 1;
    FOR i IN 0..n - 1 LOOP
        xi := (p_ring -> i ->> 0)::FLOAT8; yi := (p_ring -> i ->> 1)::FLOAT8;
        xj := (p_ring -> j ->> 0)::FLOAT8; yj := (p_ring -> j ->> 1)::FLOAT8;
        IF ((yi > p_lat) <> (yj > p_lat)) AND (p_lng < (xj - xi) * (p_lat - yi) / (yj - yi) + xi) THEN
            inside := NOT inside;
        END IF;
        j := i;
    END LOOP;
    RETURN inside;
END $$;

-- Restricted zones win when zones overlap, so a restricted area inside a regular one still blocks bookings.
CREATE OR REPLACE FUNCTION fn_zone_at(p_lat NUMERIC, p_lng NUMERIC, p_city_id SMALLINT DEFAULT NULL)
RETURNS BIGINT LANGUAGE sql STABLE AS $$
    SELECT id FROM zones
    WHERE is_active AND boundary_geojson IS NOT NULL
      AND (p_city_id IS NULL OR city_id = p_city_id)
      AND fn_point_in_ring(p_lat, p_lng, boundary_geojson -> 'coordinates' -> 0)
    ORDER BY (zone_type = 'restricted') DESC, id
    LIMIT 1
$$;

ALTER TABLE zones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
