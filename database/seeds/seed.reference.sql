-- seed.reference.sql — reference data every environment needs to boot the
-- app (doc 07 §2 planned layout). Idempotent: safe to re-run.
--
-- Currently seeds only `roles`, since that's what the auth module (M2)
-- needs — POST /auth/register assigns new accounts the PASSENGER role and
-- fails its FK insert into user_roles without a seeded row here. Cities,
-- vehicle_categories and pricing_rules join this file once the milestones
-- that need them (M3/M4) land.

INSERT INTO roles (name, description) VALUES
    ('PASSENGER', 'Books and takes rides'),
    ('DRIVER', 'Drives and fulfills ride requests'),
    ('ADMIN', 'Platform staff with operational access')
ON CONFLICT (name) DO NOTHING;
