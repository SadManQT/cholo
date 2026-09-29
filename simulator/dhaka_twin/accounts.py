"""Create simulator accounts directly in Cholo's PostgreSQL database.

Riders get phones ``0130xxxxxxx`` and drivers ``0140xxxxxxx``; every account
uses the same password. Drivers are approved with an approved, active vehicle,
so they can go online immediately. Both get a large wallet balance so cash
commission never locks a driver out and wallet rides never bounce.

The password hash uses bcrypt cost 4 (the server accepts any cost), so the
simulator can log thousands of agents in without burning server CPU.
Re-running is safe: existing simulator accounts are updated, not duplicated.
"""

from __future__ import annotations

RIDER_PREFIX = "0130"
DRIVER_PREFIX = "0140"
RIDER_NAME = "Twin Rider"
DRIVER_NAME = "Twin Driver"
OPENING_BALANCE = 100_000

# Vehicle category names in seed.reference.sql -> simulator vehicle kinds.
CATEGORY_KINDS = {"Bike": "bike", "CNG": "cng", "Car": "car", "Car Premium": "premium"}


def rider_phone(i: int) -> str:
    return f"{RIDER_PREFIX}{i:07d}"


def driver_phone(i: int) -> str:
    return f"{DRIVER_PREFIX}{i:07d}"


# Deterministic vehicle split by driver number: 45% bike, 15% CNG, 33% car, 7% premium.
# Only used inside parameterised queries, hence the escaped modulo operator.
VEHICLE_CASE = """
CASE
  WHEN (i * 37) %% 100 < 45 THEN 'Bike'
  WHEN (i * 37) %% 100 < 60 THEN 'CNG'
  WHEN (i * 37) %% 100 < 93 THEN 'Car'
  ELSE 'Car Premium'
END
"""

SQL_RIDERS = """
INSERT INTO users (full_name, phone, password_hash, gender, phone_verified_at, status)
SELECT %(name)s || ' ' || lpad(i::text, 6, '0'), %(prefix)s || lpad(i::text, 7, '0'), %(hash)s,
       (CASE WHEN i %% 20 < 7 THEN 'female' ELSE 'male' END)::user_gender, now(), 'active'
FROM generate_series(1, %(n)s) AS i
ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active', deleted_at = NULL
"""

SQL_ROLE = """
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u CROSS JOIN roles r
WHERE r.name = %(role)s AND u.phone LIKE %(like)s AND u.full_name LIKE %(name_like)s
ON CONFLICT DO NOTHING
"""

SQL_PASSENGER_PROFILES = """
INSERT INTO passenger_profiles (user_id, default_city_id)
SELECT u.id, %(city)s FROM users u WHERE u.phone LIKE %(like)s AND u.full_name LIKE %(name_like)s
ON CONFLICT (user_id) DO NOTHING
"""

SQL_DRIVERS = f"""
INSERT INTO users (full_name, phone, password_hash, gender, phone_verified_at, status)
SELECT %(name)s || ' ' || lpad(i::text, 6, '0'), %(prefix)s || lpad(i::text, 7, '0'), %(hash)s,
       (CASE WHEN {VEHICLE_CASE} <> 'Bike' AND i %% 17 = 0 THEN 'female' ELSE 'male' END)::user_gender, now(), 'active'
FROM generate_series(1, %(n)s) AS i
ON CONFLICT (phone) DO UPDATE SET password_hash = EXCLUDED.password_hash, status = 'active', deleted_at = NULL
"""

SQL_DRIVER_PROFILES = """
INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status, verified_at)
SELECT u.id, '7' || lpad(i::text, 9, '0'), 'DHAKA-TWIN-' || lpad(i::text, 7, '0'), current_date + 730, 'approved', now()
FROM generate_series(1, %(n)s) AS i
JOIN users u ON u.phone = %(prefix)s || lpad(i::text, 7, '0')
ON CONFLICT (user_id) DO UPDATE SET verification_status = 'approved', license_expiry = EXCLUDED.license_expiry
"""

SQL_VEHICLES = f"""
INSERT INTO vehicles (driver_id, category_id, registration_no, brand, model, model_year, color, verification_status, is_active)
SELECT u.id, vc.id, 'DHAKA-TWIN-' || lpad(i::text, 7, '0'), 'Twin', {VEHICLE_CASE}, 2023, 'White', 'approved', true
FROM generate_series(1, %(n)s) AS i
JOIN users u ON u.phone = %(prefix)s || lpad(i::text, 7, '0')
JOIN vehicle_categories vc ON vc.name = {VEHICLE_CASE}
ON CONFLICT (registration_no) DO UPDATE SET verification_status = 'approved', is_active = true
"""

SQL_ACTIVE_VEHICLE = """
UPDATE driver_profiles dp SET active_vehicle_id = v.id
FROM vehicles v
WHERE v.driver_id = dp.user_id AND v.registration_no LIKE 'DHAKA-TWIN-%%' AND dp.active_vehicle_id IS DISTINCT FROM v.id
"""

SQL_TOPUP = """
INSERT INTO wallet_transactions (wallet_id, txn_type, direction, amount, balance_after, reference_type, idempotency_key, note)
SELECT w.id, 'topup', 'credit', %(amount)s, 0, 'manual', 'dhaka-twin-opening-' || u.phone, 'Dhaka twin opening balance'
FROM wallets w JOIN users u ON u.id = w.user_id
WHERE u.phone LIKE %(like)s AND u.full_name LIKE %(name_like)s
ON CONFLICT (idempotency_key) DO NOTHING
"""


def password_hash(password: str, rounds: int = 4) -> str:
    import bcrypt

    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=rounds)).decode()


def seed_accounts(database_url: str, *, drivers: int, riders: int, password: str, seed: int = 42) -> dict:
    import psycopg

    hashed = password_hash(password)
    rider_like = f"{RIDER_PREFIX}%"
    driver_like = f"{DRIVER_PREFIX}%"
    with psycopg.connect(database_url) as conn, conn.cursor() as cur:
        cur.execute("SELECT id FROM cities WHERE name = 'Dhaka'")
        row = cur.fetchone()
        if row is None:
            raise RuntimeError("city 'Dhaka' not found: run `npm run db:init` in server/ first")
        city = row[0]
        cur.execute(SQL_RIDERS, {"name": RIDER_NAME, "prefix": RIDER_PREFIX, "hash": hashed, "n": riders})
        cur.execute(SQL_ROLE, {"role": "PASSENGER", "like": rider_like, "name_like": f"{RIDER_NAME} %"})
        cur.execute(SQL_PASSENGER_PROFILES, {"city": city, "like": rider_like, "name_like": f"{RIDER_NAME} %"})
        cur.execute(SQL_DRIVERS, {"name": DRIVER_NAME, "prefix": DRIVER_PREFIX, "hash": hashed, "n": drivers})
        cur.execute(SQL_ROLE, {"role": "DRIVER", "like": driver_like, "name_like": f"{DRIVER_NAME} %"})
        cur.execute(SQL_DRIVER_PROFILES, {"prefix": DRIVER_PREFIX, "n": drivers})
        cur.execute(SQL_VEHICLES, {"prefix": DRIVER_PREFIX, "n": drivers})
        cur.execute(SQL_ACTIVE_VEHICLE)
        for like, name in ((rider_like, RIDER_NAME), (driver_like, DRIVER_NAME)):
            cur.execute(SQL_TOPUP, {"amount": OPENING_BALANCE, "like": like, "name_like": f"{name} %"})
        cur.execute(
            "SELECT vc.name, count(*) FROM vehicles v JOIN vehicle_categories vc ON vc.id = v.category_id "
            "WHERE v.registration_no LIKE 'DHAKA-TWIN-%%' GROUP BY vc.name ORDER BY vc.name"
        )
        vehicles = dict(cur.fetchall())
        conn.commit()
    return {"riders": riders, "drivers": drivers, "vehicles": vehicles, "rider_phones": f"{rider_phone(1)}..",
            "driver_phones": f"{driver_phone(1)}.."}
