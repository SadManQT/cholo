-- seed.reference.sql — reference data every environment needs to boot the
-- app (doc 07 §2 planned layout). Idempotent: safe to re-run.
--
-- M2 needs roles for authentication. M3 adds the vehicle categories used by
-- fleet registration. M4 adds the city and the illustrative Dhaka tariff
-- card (doc 01 §6.1) that fn_current_pricing resolves for /rides/quote.

INSERT INTO roles (name, description) VALUES
    ('PASSENGER', 'Books and takes rides'),
    ('DRIVER', 'Drives and fulfills ride requests'),
    ('ADMIN', 'Platform staff with operational access'),
    ('SUPPORT', 'Customer support staff')
ON CONFLICT (name) DO NOTHING;

INSERT INTO vehicle_categories
    (name, description, seat_capacity, sort_order)
VALUES
    ('Bike', 'Fast, affordable motorcycle rides', 1, 1),
    ('CNG', 'Three-wheeler rides for small groups', 3, 2),
    ('Car', 'Comfortable everyday car rides', 4, 3),
    ('Car Premium', 'Higher-end cars and service', 4, 4)
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    seat_capacity = EXCLUDED.seat_capacity,
    sort_order = EXCLUDED.sort_order;

INSERT INTO cities (name, country, timezone, currency, launched_at) VALUES
    ('Dhaka', 'Bangladesh', 'Asia/Dhaka', 'BDT', '2026-01-01')
ON CONFLICT (name) DO UPDATE SET
    country = EXCLUDED.country,
    timezone = EXCLUDED.timezone,
    currency = EXCLUDED.currency,
    launched_at = EXCLUDED.launched_at;

-- Illustrative Dhaka tariff (doc 01 §6.1). effective_from is a fixed
-- timestamp, not now(), so re-running this file hits the same UNIQUE
-- (city_id, category_id, effective_from) row instead of minting a new one
-- every time.
INSERT INTO pricing_rules
    (city_id, category_id, base_fare, per_km_rate, per_min_rate, minimum_fare, booking_fee, effective_from)
SELECT
    (SELECT id FROM cities WHERE name = 'Dhaka'),
    vc.id,
    tariff.base_fare, tariff.per_km_rate, tariff.per_min_rate, tariff.minimum_fare, tariff.booking_fee,
    TIMESTAMPTZ '2026-01-01 00:00:00+06'
FROM (VALUES
    ('Bike', 25.00, 12.00, 1.00, 40.00, 5.00),
    ('CNG', 40.00, 15.00, 1.50, 70.00, 5.00),
    ('Car', 60.00, 22.00, 2.50, 120.00, 10.00),
    ('Car Premium', 90.00, 30.00, 3.50, 200.00, 10.00)
) AS tariff(category_name, base_fare, per_km_rate, per_min_rate, minimum_fare, booking_fee)
JOIN vehicle_categories vc ON vc.name = tariff.category_name
ON CONFLICT (city_id, category_id, effective_from) DO UPDATE SET
    base_fare = EXCLUDED.base_fare,
    per_km_rate = EXCLUDED.per_km_rate,
    per_min_rate = EXCLUDED.per_min_rate,
    minimum_fare = EXCLUDED.minimum_fare,
    booking_fee = EXCLUDED.booking_fee;
