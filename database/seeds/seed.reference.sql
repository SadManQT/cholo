-- seed.reference.sql — reference data every environment needs to boot the
-- app (doc 07 §2 planned layout). Idempotent: safe to re-run.
--
-- M2 needs roles for authentication. M3 adds the vehicle categories used by
-- fleet registration. Cities and pricing rules join this file in M4.

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
