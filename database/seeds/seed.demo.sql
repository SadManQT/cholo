-- Cholo demo dataset: run after schema.sql, migrations 0001-0013 (0003 only if fn_current_commission is missing) and seed.reference.sql. Safe to re-run.
CREATE SCHEMA IF NOT EXISTS cholo_demo_seed;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_hav(a1 numeric, o1 numeric, a2 numeric, o2 numeric)
RETURNS numeric LANGUAGE sql IMMUTABLE AS $f$
  SELECT (6371 * 2 * asin(sqrt(
    power(sin(radians(a2 - a1) / 2), 2) +
    cos(radians(a1)) * cos(radians(a2)) * power(sin(radians(o2 - o1) / 2), 2))))::numeric
$f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_fare(
  p_base numeric, p_perkm numeric, p_permin numeric, p_minfare numeric, p_booking numeric,
  p_waitrate numeric, p_freewait numeric, p_km numeric, p_dur numeric, p_wait numeric, p_mult numeric,
  OUT o_base numeric, OUT o_dist numeric, OUT o_time numeric, OUT o_wait numeric,
  OUT o_surge numeric, OUT o_booking numeric, OUT o_total numeric)
LANGUAGE plpgsql AS $f$
DECLARE ride numeric; exact numeric; adj numeric;
BEGIN
  o_base := round(p_base, 2);
  o_time := round(p_dur * p_permin, 2);
  o_wait := round(greatest(0, p_wait - p_freewait) * p_waitrate, 2);
  o_booking := round(p_booking, 2);
  o_dist := round(p_km * p_perkm, 2);
  ride := round(o_base + o_dist + o_time, 2);
  IF ride < p_minfare THEN
    o_dist := round(o_dist + (p_minfare - ride), 2);
    ride := p_minfare;
  END IF;
  o_surge := round(ride * (p_mult - 1), 2);
  exact := round(o_base + o_dist + o_time + o_wait + o_surge + o_booking, 2);
  o_total := round(exact);
  adj := round(o_total - exact, 2);
  IF o_dist + adj >= 0 THEN o_dist := round(o_dist + adj, 2);
  ELSE o_base := round(o_base + adj, 2);
  END IF;
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_hour() RETURNS int LANGUAGE plpgsql AS $f$
DECLARE
  w numeric[] := ARRAY[0.8,0.5,0.4,0.3,0.4,0.9,2,3,10,10,7,4,4,4,4,4,3,9,11,10,7,3,2,1.2];
  tot numeric := 0; r numeric; acc numeric := 0; i int;
BEGIN
  FOR i IN 1..24 LOOP tot := tot + w[i]; END LOOP;
  r := random() * tot;
  FOR i IN 1..24 LOOP
    acc := acc + w[i];
    IF r < acc THEN RETURN i - 1; END IF;
  END LOOP;
  RETURN 18;
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_ts(p_today date, p_now timestamptz) RETURNS timestamptz
LANGUAGE plpgsql AS $f$
DECLARE d int; ts timestamptz; tries int := 0;
BEGIN
  LOOP
    LOOP
      d := floor(60 * power(random(), 1.35))::int;
      EXIT WHEN NOT (extract(dow FROM (p_today - d)) = 5 AND random() > 0.6);
    END LOOP;
    ts := ((p_today - d)::timestamp
           + make_interval(hours => cholo_demo_seed.d_hour(), mins => floor(random() * 60)::int, secs => floor(random() * 60)::int))
          AT TIME ZONE 'Asia/Dhaka';
    tries := tries + 1;
    EXIT WHEN ts <= p_now - interval '45 minutes' OR tries > 30;
  END LOOP;
  IF ts > p_now - interval '45 minutes' THEN ts := ts - interval '1 day'; END IF;
  RETURN ts;
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_ts_old(p_today date) RETURNS timestamptz
LANGUAGE plpgsql AS $f$
DECLARE d int;
BEGIN
  LOOP
    d := 61 + floor(90 * power(random(), 1.8))::int;
    EXIT WHEN NOT (extract(dow FROM (p_today - d)) = 5 AND random() > 0.6);
  END LOOP;
  RETURN ((p_today - d)::timestamp
          + make_interval(hours => cholo_demo_seed.d_hour(), mins => floor(random() * 60)::int, secs => floor(random() * 60)::int))
         AT TIME ZONE 'Asia/Dhaka';
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_txn(
  p_user bigint, p_ts timestamptz, p_type wallet_txn_type, p_dir wallet_txn_direction, p_amt numeric,
  p_rt wallet_txn_reference_type, p_ref bigint, p_key text, p_note text)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE b RECORD; ts timestamptz;
BEGIN
  IF p_amt IS NULL OR p_amt <= 0 THEN RETURN; END IF;
  SELECT * INTO b FROM _bal WHERE user_id = p_user;
  ts := greatest(p_ts, b.last_ts);
  INSERT INTO wallet_transactions
    (wallet_id, txn_type, direction, amount, balance_after, reference_type, reference_id, idempotency_key, note, created_at)
  VALUES (b.wallet_id, p_type, p_dir, p_amt, 0, p_rt, p_ref, p_key, p_note, ts);
  UPDATE _bal SET bal = bal + CASE WHEN p_dir = 'credit' THEN p_amt ELSE -p_amt END, last_ts = ts WHERE user_id = p_user;
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_topup(p_user bigint, p_amt numeric, p_ts timestamptz)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE pid bigint; m payment_channel; ts timestamptz; b RECORD;
BEGIN
  SELECT * INTO b FROM _bal WHERE user_id = p_user;
  ts := greatest(p_ts, b.last_ts);
  m := (ARRAY['bkash','nagad','card','bkash','nagad'])[1 + floor(random() * 5)::int]::payment_channel;
  INSERT INTO payments (purpose, payer_id, method_type, gateway, gateway_txn_id, amount, status, initiated_at, completed_at)
  VALUES ('wallet_topup', p_user, m, 'sslcommerz',
          'SSL' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 14)),
          p_amt, 'succeeded', ts - interval '40 seconds', ts)
  RETURNING id INTO pid;
  PERFORM cholo_demo_seed.d_txn(p_user, ts, 'topup', 'credit', p_amt, 'payment', pid, 'topup-payment-' || pid, NULL);
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_fund(p_user bigint, p_need numeric, p_ts timestamptz)
RETURNS void LANGUAGE plpgsql AS $f$
DECLARE b RECORD;
BEGIN
  SELECT * INTO b FROM _bal WHERE user_id = p_user;
  IF b.bal >= p_need THEN RETURN; END IF;
  PERFORM cholo_demo_seed.d_topup(p_user, ceil((p_need - b.bal + 100) / 500.0) * 500, p_ts);
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_mix(p_dhaka smallint, p_ctg smallint, p_syl smallint, p_bike smallint,
  p_cng smallint, p_car smallint, p_prem smallint, OUT o_city smallint, OUT o_cat smallint)
LANGUAGE plpgsql AS $f$
DECLARE r1 numeric := random(); r2 numeric := random();
BEGIN
  o_city := CASE WHEN r1 < 0.80 THEN p_dhaka WHEN r1 < 0.92 THEN p_ctg ELSE p_syl END;
  o_cat := CASE WHEN o_city = p_dhaka THEN
                  CASE WHEN r2 < 0.40 THEN p_bike WHEN r2 < 0.62 THEN p_cng WHEN r2 < 0.94 THEN p_car ELSE p_prem END
                WHEN o_city = p_ctg THEN
                  CASE WHEN r2 < 0.46 THEN p_bike WHEN r2 < 0.74 THEN p_cng ELSE p_car END
                ELSE CASE WHEN r2 < 0.58 THEN p_bike ELSE p_cng END END;
END $f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_when(p_today date, p_min_days int, p_span int) RETURNS timestamptz
LANGUAGE sql VOLATILE AS $f$
  SELECT ((p_today - (p_min_days + floor(random() * p_span))::int)::timestamp
          + make_interval(hours => 8 + floor(random() * 13)::int, mins => floor(random() * 60)::int)) AT TIME ZONE 'Asia/Dhaka'
$f$;

CREATE OR REPLACE FUNCTION cholo_demo_seed.d_addr(p_name text, p_area text, p_city text)
RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE WHEN lower(p_name) = lower(p_area) THEN p_name || ', ' || p_city
              ELSE p_name || ', ' || p_area || ', ' || p_city END
$f$;

DO $demo$
DECLARE
  c_hash CONSTANT text := chr(36) || '2b' || chr(36) || '12' || chr(36) || 'WOaMwC4X4gaEJTpE9DGw/uGTxEDN49DOkjppNvr3z3.gcD4qoF/ce';
  v_now   timestamptz := now();
  v_today date := (now() AT TIME ZONE 'Asia/Dhaka')::date;
  v_dhaka smallint;
  v_ctg   smallint;
  v_syl   smallint;
  c_bike  smallint;
  c_cng   smallint;
  c_car   smallint;
  c_prem  smallint;
  r_pax   smallint;
  r_drv   smallint;
  r_adm   smallint;
  r_sup   smallint;
  v_super bigint;
  v_fin   bigint;
  v_sup   bigint;
BEGIN
  -- Guard: skip when the demo dataset is already present
  IF EXISTS (SELECT 1 FROM audit_logs WHERE action = 'DEMO_DATASET_SEEDED') THEN
    RAISE NOTICE 'seed.demo.sql: demo dataset already present, nothing to do.';
    RETURN;
  END IF;

  SELECT id INTO v_dhaka FROM cities WHERE name = 'Dhaka';
  SELECT id INTO c_bike FROM vehicle_categories WHERE name = 'Bike';
  SELECT id INTO c_cng  FROM vehicle_categories WHERE name = 'CNG';
  SELECT id INTO c_car  FROM vehicle_categories WHERE name = 'Car';
  SELECT id INTO c_prem FROM vehicle_categories WHERE name = 'Car Premium';
  SELECT id INTO r_pax FROM roles WHERE name = 'PASSENGER';
  SELECT id INTO r_drv FROM roles WHERE name = 'DRIVER';
  SELECT id INTO r_adm FROM roles WHERE name = 'ADMIN';
  SELECT id INTO r_sup FROM roles WHERE name = 'SUPPORT';
  IF v_dhaka IS NULL OR c_bike IS NULL OR c_cng IS NULL OR c_car IS NULL OR c_prem IS NULL
     OR r_pax IS NULL OR r_drv IS NULL OR r_adm IS NULL OR r_sup IS NULL
     OR NOT EXISTS (SELECT 1 FROM commission_rules) THEN
    RAISE EXCEPTION 'Run schema.sql, all migrations and seed.reference.sql before seed.demo.sql';
  END IF;

  PERFORM set_config('client_min_messages', 'warning', true);
  PERFORM setseed(0.4242);
  DROP TABLE IF EXISTS _loc, _pax, _drv, _ev, _bal, _surged, _tk;

  -- Helper functions (session-local, dropped at the end)





  -- Admins
  UPDATE users SET phone = '01510009993' WHERE email = 'admin.demo@cholo.local' AND phone = '01910000003';

  INSERT INTO users (full_name, phone, email, password_hash, gender, phone_verified_at, status, created_at, last_login_at)
  VALUES
    ('Ayesha Admin', '01510009993', 'admin.demo@cholo.local', c_hash, 'female', v_now - interval '150 days', 'active', v_now - interval '150 days', v_now - interval '35 minutes'),
    ('Rezwana Karim', '01510009994', 'finance.demo@cholo.local', c_hash, 'female', v_now - interval '140 days', 'active', v_now - interval '140 days', v_now - interval '3 hours'),
    ('Imtiaz Ahmed', '01510009995', 'support.demo@cholo.local', c_hash, 'male', v_now - interval '130 days', 'active', v_now - interval '130 days', v_now - interval '95 minutes')
  ON CONFLICT (phone) DO NOTHING;

  SELECT id INTO v_super FROM users WHERE phone = '01510009993';
  SELECT id INTO v_fin   FROM users WHERE phone = '01510009994';
  SELECT id INTO v_sup   FROM users WHERE phone = '01510009995';

  INSERT INTO user_roles (user_id, role_id) VALUES (v_super, r_adm), (v_fin, r_adm), (v_sup, r_adm), (v_sup, r_sup)
  ON CONFLICT DO NOTHING;
  INSERT INTO admin_profiles (user_id, designation, access_level) VALUES
    (v_super, 'Demo Super Admin', 'super'),
    (v_fin, 'Finance Manager', 'finance'),
    (v_sup, 'Support Lead', 'support')
  ON CONFLICT (user_id) DO NOTHING;

  -- Bring accounts created earlier by seed.dev.sql back to the start of the timeline
  UPDATE users SET created_at = v_now - interval '151 days', phone_verified_at = v_now - interval '151 days'
  WHERE phone IN ('01710000001', '01810000002', '01510009993') AND created_at > v_now - interval '140 days';
  UPDATE passenger_profiles SET created_at = v_now - interval '151 days'
  WHERE user_id IN (SELECT id FROM users WHERE phone = '01710000001') AND created_at > v_now - interval '140 days';
  UPDATE driver_profiles SET created_at = v_now - interval '151 days', verified_at = v_now - interval '149 days'
  WHERE user_id IN (SELECT id FROM users WHERE phone = '01810000002') AND created_at > v_now - interval '140 days';
  UPDATE vehicles SET created_at = v_now - interval '151 days'
  WHERE driver_id IN (SELECT id FROM users WHERE phone = '01810000002') AND created_at > v_now - interval '140 days';
  ALTER TABLE wallet_transactions DISABLE TRIGGER trg_block_update_wallet_transactions;
  UPDATE wallet_transactions
  SET created_at = v_now - interval '150 days 12 hours' + (id % 10) * interval '1 second'
  WHERE idempotency_key IN ('demo-nusrat-opening-balance', 'demo-rafiq-opening-balance', 'demo-trip-commission', 'demo-withdrawal-hold');
  ALTER TABLE wallet_transactions ENABLE TRIGGER trg_block_update_wallet_transactions;

  -- Cities, tariffs, commission rules
  INSERT INTO cities (name, country, timezone, currency, launched_at) VALUES
    ('Chattogram', 'Bangladesh', 'Asia/Dhaka', 'BDT', DATE '2026-03-01'),
    ('Sylhet', 'Bangladesh', 'Asia/Dhaka', 'BDT', DATE '2026-05-15')
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_ctg FROM cities WHERE name = 'Chattogram';
  SELECT id INTO v_syl FROM cities WHERE name = 'Sylhet';

  INSERT INTO pricing_rules
    (city_id, category_id, base_fare, per_km_rate, per_min_rate, minimum_fare, booking_fee, effective_from, created_by)
  SELECT c.id, vc.id, t.base_fare, t.per_km, t.per_min, t.min_fare, t.booking_fee, t.eff, v_super
  FROM (VALUES
    ('Chattogram', 'Bike',        25.00, 11.00, 1.00,  40.00,  5.00, TIMESTAMPTZ '2026-03-01 00:00:00+06'),
    ('Chattogram', 'CNG',         40.00, 14.00, 1.50,  70.00,  5.00, TIMESTAMPTZ '2026-03-01 00:00:00+06'),
    ('Chattogram', 'Car',         60.00, 21.00, 2.50, 120.00, 10.00, TIMESTAMPTZ '2026-03-01 00:00:00+06'),
    ('Chattogram', 'Car Premium', 90.00, 29.00, 3.50, 200.00, 10.00, TIMESTAMPTZ '2026-03-01 00:00:00+06'),
    ('Sylhet',     'Bike',        20.00, 10.00, 1.00,  35.00,  5.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Sylhet',     'CNG',         35.00, 13.00, 1.50,  60.00,  5.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Sylhet',     'Car',         55.00, 20.00, 2.00, 110.00, 10.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Sylhet',     'Car Premium', 85.00, 28.00, 3.00, 180.00, 10.00, TIMESTAMPTZ '2026-05-15 00:00:00+06')
  ) AS t(city, category, base_fare, per_km, per_min, min_fare, booking_fee, eff)
  JOIN cities c ON c.name = t.city
  JOIN vehicle_categories vc ON vc.name = t.category
  ON CONFLICT (city_id, category_id, effective_from) DO NOTHING;

  INSERT INTO commission_rules (category_id, city_id, commission_pct, effective_from, created_by)
  SELECT vc.id, c.id, t.pct, t.eff, v_super
  FROM (VALUES
    ('Sylhet', 'Bike',        12.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Sylhet', 'CNG',         12.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Sylhet', 'Car',         12.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Sylhet', 'Car Premium', 12.00, TIMESTAMPTZ '2026-05-15 00:00:00+06'),
    ('Dhaka',  'Bike',        12.00, (v_today - 25)::timestamp AT TIME ZONE 'Asia/Dhaka')
  ) AS t(city, category, pct, eff)
  JOIN cities c ON c.name = t.city
  JOIN vehicle_categories vc ON vc.name = t.category
  ON CONFLICT (category_id, city_id, effective_from) DO NOTHING;

  INSERT INTO zones (city_id, name, zone_type, boundary_geojson)
  SELECT c.id, z.name, z.ztype::zone_type,
         jsonb_build_object('type', 'Polygon', 'coordinates', jsonb_build_array(jsonb_build_array(
           jsonb_build_array(z.lng - z.dlng, z.lat - z.dlat),
           jsonb_build_array(z.lng + z.dlng, z.lat - z.dlat),
           jsonb_build_array(z.lng + z.dlng, z.lat + z.dlat),
           jsonb_build_array(z.lng - z.dlng, z.lat + z.dlat),
           jsonb_build_array(z.lng - z.dlng, z.lat - z.dlat))))
  FROM (VALUES
    ('Dhaka', 'Ganabhaban Security Zone',   'restricted', 23.7621, 90.3803, 0.0035, 0.0040),
    ('Dhaka', 'Hazrat Shahjalal Airport',   'airport',    23.8433, 90.3978, 0.0110, 0.0140),
    ('Dhaka', 'Kamalapur Railway Station',  'station',    23.7310, 90.4260, 0.0060, 0.0080),
    ('Dhaka', 'Farmgate-Tejgaon',           'regular',    23.7600, 90.3920, 0.0140, 0.0140),
    ('Dhaka', 'Gulshan-Banani',             'regular',    23.7940, 90.4110, 0.0200, 0.0220),
    ('Dhaka', 'Dhanmondi-Lalmatia',         'regular',    23.7480, 90.3740, 0.0160, 0.0200),
    ('Dhaka', 'Mirpur-Shyamoli',            'regular',    23.8030, 90.3650, 0.0350, 0.0300),
    ('Dhaka', 'Uttara',                     'regular',    23.8710, 90.3870, 0.0350, 0.0280),
    ('Dhaka', 'Motijheel-Old Dhaka',        'regular',    23.7240, 90.4050, 0.0300, 0.0450),
    ('Dhaka', 'Rampura-Bashundhara',        'regular',    23.7900, 90.4300, 0.0450, 0.0300),
    ('Chattogram', 'Shah Amanat Airport',   'airport',    22.2496, 91.8133, 0.0120, 0.0150),
    ('Chattogram', 'Chattogram City',       'regular',    22.3400, 91.8300, 0.0600, 0.0600),
    ('Sylhet', 'Osmani Airport',            'airport',    24.9632, 91.8668, 0.0100, 0.0120),
    ('Sylhet', 'Sylhet City',               'regular',    24.9000, 91.8600, 0.0500, 0.0450)
  ) AS z(city, name, ztype, lat, lng, dlat, dlng)
  JOIN cities c ON c.name = z.city
  ON CONFLICT (city_id, name) DO NOTHING;

  -- Places used to build trips
  CREATE TEMP TABLE _loc AS
  SELECT (row_number() OVER ())::int AS id, c.id AS city_id, l.name::text AS name, l.area::text AS area,
         l.lat::numeric AS lat, l.lng::numeric AS lng, l.w::numeric AS w
  FROM (VALUES
    ('Dhaka', 'Road 27', 'Dhanmondi', 23.7461, 90.3742, 3),
    ('Dhaka', 'Science Laboratory', 'Dhanmondi', 23.7385, 90.3830, 1.5),
    ('Dhaka', 'Dhanmondi 32', 'Dhanmondi', 23.7530, 90.3760, 1.5),
    ('Dhaka', 'Lalmatia Block D', 'Lalmatia', 23.7550, 90.3690, 1),
    ('Dhaka', 'Gulshan 2 Circle', 'Gulshan', 23.7925, 90.4144, 3),
    ('Dhaka', 'Gulshan 1 Circle', 'Gulshan', 23.7808, 90.4167, 2),
    ('Dhaka', 'Banani Road 11', 'Banani', 23.7937, 90.4043, 2.5),
    ('Dhaka', 'Baridhara Diplomatic Zone', 'Baridhara', 23.8000, 90.4200, 1),
    ('Dhaka', 'United Hospital', 'Gulshan', 23.8041, 90.4152, 1),
    ('Dhaka', 'Mohakhali Bus Terminal', 'Mohakhali', 23.7783, 90.3976, 1.5),
    ('Dhaka', 'Farmgate', 'Tejgaon', 23.7561, 90.3872, 2.5),
    ('Dhaka', 'Karwan Bazar', 'Tejgaon', 23.7513, 90.3934, 2),
    ('Dhaka', 'Bashundhara City Shopping Complex', 'Panthapath', 23.7516, 90.3912, 2),
    ('Dhaka', 'Square Hospital', 'Panthapath', 23.7529, 90.3810, 1),
    ('Dhaka', 'Shahbag', 'Shahbag', 23.7386, 90.3958, 2),
    ('Dhaka', 'Dhaka University TSC', 'Nilkhet', 23.7340, 90.3960, 1.5),
    ('Dhaka', 'BUET', 'Palashi', 23.7265, 90.3925, 1),
    ('Dhaka', 'New Market', 'New Market', 23.7340, 90.3850, 1.5),
    ('Dhaka', 'Motijheel Shapla Chattar', 'Motijheel', 23.7330, 90.4172, 2.5),
    ('Dhaka', 'Paltan', 'Paltan', 23.7345, 90.4130, 1),
    ('Dhaka', 'Gulistan', 'Gulistan', 23.7241, 90.4131, 1),
    ('Dhaka', 'Kamalapur Railway Station', 'Kamalapur', 23.7310, 90.4260, 2),
    ('Dhaka', 'Sadarghat Launch Terminal', 'Sadarghat', 23.7086, 90.4070, 1),
    ('Dhaka', 'Chawkbazar', 'Old Dhaka', 23.7160, 90.3980, 0.8),
    ('Dhaka', 'Jatrabari', 'Jatrabari', 23.7099, 90.4340, 1.2),
    ('Dhaka', 'Malibagh Railgate', 'Malibagh', 23.7490, 90.4160, 1.2),
    ('Dhaka', 'Rampura Bridge', 'Rampura', 23.7614, 90.4241, 1.5),
    ('Dhaka', 'Badda Link Road', 'Badda', 23.7806, 90.4258, 1.2),
    ('Dhaka', 'Bashundhara R/A Block D', 'Bashundhara', 23.8193, 90.4320, 1.8),
    ('Dhaka', 'Jamuna Future Park', 'Kuril', 23.8135, 90.4245, 1.5),
    ('Dhaka', 'Banasree Main Road', 'Banasree', 23.7627, 90.4330, 1),
    ('Dhaka', 'Khilgaon Chowdhury Para', 'Khilgaon', 23.7510, 90.4290, 1),
    ('Dhaka', 'Uttara Sector 7', 'Uttara', 23.8759, 90.3795, 3),
    ('Dhaka', 'Uttara Sector 3', 'Uttara', 23.8687, 90.3900, 1.5),
    ('Dhaka', 'Hazrat Shahjalal International Airport', 'Airport', 23.8433, 90.3978, 3),
    ('Dhaka', 'Mirpur 10 Circle', 'Mirpur', 23.8069, 90.3687, 3),
    ('Dhaka', 'Mirpur 1', 'Mirpur', 23.7956, 90.3537, 1.5),
    ('Dhaka', 'Mirpur DOHS', 'Mirpur', 23.8388, 90.3663, 1),
    ('Dhaka', 'Shewrapara', 'Mirpur', 23.7906, 90.3735, 1),
    ('Dhaka', 'Technical More', 'Mirpur', 23.7830, 90.3540, 1),
    ('Dhaka', 'Shyamoli Square', 'Shyamoli', 23.7745, 90.3660, 1.5),
    ('Dhaka', 'Adabor Road 5', 'Adabor', 23.7715, 90.3585, 1),
    ('Dhaka', 'Mohammadpur Town Hall', 'Mohammadpur', 23.7590, 90.3590, 1.5),
    ('Dhaka', 'Gabtoli Bus Terminal', 'Gabtoli', 23.7783, 90.3436, 1),
    ('Dhaka', 'Agargaon', 'Agargaon', 23.7780, 90.3800, 1.2),
    ('Dhaka', 'Sayedabad Bus Terminal', 'Sayedabad', 23.7118, 90.4291, 0.8),
    ('Dhaka', 'Azimpur', 'Azimpur', 23.7290, 90.3865, 0.8),
    ('Dhaka', 'Tejgaon Industrial Area', 'Tejgaon', 23.7660, 90.4000, 0.8),
    ('Chattogram', 'GEC Circle', 'Nasirabad', 22.3591, 91.8210, 3),
    ('Chattogram', 'Agrabad Commercial Area', 'Agrabad', 22.3247, 91.8110, 3),
    ('Chattogram', 'Shah Amanat International Airport', 'Patenga', 22.2496, 91.8133, 2),
    ('Chattogram', 'Patenga Sea Beach', 'Patenga', 22.2371, 91.7920, 1.5),
    ('Chattogram', 'Chawkbazar', 'Chawkbazar', 22.3540, 91.8430, 1.5),
    ('Chattogram', 'Oxygen Circle', 'Oxygen', 22.3776, 91.8210, 1.5),
    ('Chattogram', 'Halishahar', 'Halishahar', 22.3370, 91.7870, 1),
    ('Chattogram', 'Kotwali Mor', 'Kotwali', 22.3350, 91.8350, 1),
    ('Chattogram', 'Chattogram Railway Station', 'Station Road', 22.3300, 91.8440, 1.5),
    ('Chattogram', 'Chattogram Medical College Hospital', 'Panchlaish', 22.3610, 91.8330, 1),
    ('Sylhet', 'Zindabazar Point', 'Zindabazar', 24.8949, 91.8687, 3),
    ('Sylhet', 'Ambarkhana Point', 'Ambarkhana', 24.9034, 91.8710, 2.5),
    ('Sylhet', 'Osmani International Airport', 'Airport Road', 24.9632, 91.8668, 1.5),
    ('Sylhet', 'Shahjalal University of Science and Technology', 'Akhalia', 24.9195, 91.8320, 2),
    ('Sylhet', 'Sylhet Railway Station', 'Station Road', 24.8930, 91.8790, 1.5),
    ('Sylhet', 'Subid Bazar', 'Subid Bazar', 24.9010, 91.8540, 1),
    ('Sylhet', 'MAG Osmani Medical College Hospital', 'Sylhet Sadar', 24.9070, 91.8650, 1),
    ('Sylhet', 'Upashahar', 'Upashahar', 24.9065, 91.8760, 1),
    ('Sylhet', 'Bondor Bazar', 'Bondor', 24.8880, 91.8770, 1)
  ) AS l(city, name, area, lat, lng, w)
  JOIN cities c ON c.name = l.city;

  -- Passengers
  CREATE TEMP TABLE _pax AS
  SELECT p.k::int AS k, p.name::text AS name, p.phone::text AS phone, p.gender::text AS gender,
         c.id AS city_id, v_now - make_interval(days => p.days) - (p.k * 7 % 20) * interval '1 hour' AS joined_at,
         p.w::numeric AS w, p.pref::text AS pref, p.ref_by::int AS ref_by, p.susp::boolean AS susp,
         NULL::bigint AS user_id, '-infinity'::timestamptz AS busy_until,
         CASE WHEN p.susp THEN v_now - interval '4 days' END AS active_until
  FROM (VALUES
    (1,  'Nusrat Jahan',      '01710000001', 'female', 'Dhaka',      150, 4.0, 'w', NULL, false),
    (2,  'Tanvir Hasan',      '01711482930', 'male',   'Dhaka',      145, 2.5, 'c', NULL, false),
    (3,  'Farhana Akter',     '01712573841', 'female', 'Dhaka',      140, 2.0, 'b', NULL, false),
    (4,  'Mahmudul Karim',    '01713664752', 'male',   'Dhaka',      125, 1.5, 'c', NULL, false),
    (5,  'Sabrina Chowdhury', '01714755663', 'female', 'Dhaka',      118, 2.2, 'w', NULL, false),
    (6,  'Imran Hossain',     '01715846574', 'male',   'Dhaka',      110, 1.2, 'c', NULL, false),
    (7,  'Nadia Islam',       '01716937485', 'female', 'Dhaka',      104, 1.8, 'n', NULL, false),
    (8,  'Rakibul Alam',      '01717028396', 'male',   'Dhaka',       98, 1.0, 'c', NULL, false),
    (9,  'Tasnim Rahman',     '01718119207', 'female', 'Dhaka',       92, 1.4, 'k', NULL, false),
    (10, 'Shafiqul Islam',    '01719201118', 'male',   'Dhaka',       88, 0.8, 'c', NULL, false),
    (11, 'Jesmin Sultana',    '01911342231', 'female', 'Dhaka',       85, 1.0, 'c', NULL, false),
    (12, 'Arif Chowdhury',    '01912453142', 'male',   'Dhaka',       80, 1.6, 'b', NULL, false),
    (13, 'Mou Khatun',        '01913564053', 'female', 'Dhaka',       78, 0.7, 'c', NULL, false),
    (14, 'Sohel Rana',        '01914675964', 'male',   'Dhaka',       75, 1.0, 'c', NULL, true),
    (15, 'Tahmina Begum',     '01915786875', 'female', 'Dhaka',       72, 0.9, 'c', NULL, false),
    (16, 'Zahid Hasan',       '01916897786', 'male',   'Dhaka',       70, 1.3, 'n', NULL, false),
    (17, 'Maliha Rahman',     '01917908697', 'female', 'Dhaka',       66, 1.1, 'b', NULL, false),
    (18, 'Fahim Ahmed',       '01918019508', 'male',   'Dhaka',       64, 1.5, 'c', NULL, false),
    (19, 'Nusaiba Karim',     '01919120419', 'female', 'Dhaka',       60, 0.6, 'w', NULL, false),
    (20, 'Shakil Mahmud',     '01611231320', 'male',   'Dhaka',       55, 1.0, 'c', NULL, false),
    (21, 'Rumana Parvin',     '01612342231', 'female', 'Dhaka',       50, 0.8, 'c', NULL, false),
    (22, 'Anik Saha',         '01613453142', 'male',   'Dhaka',       44, 1.2, 'b', 2,    false),
    (23, 'Sumaiya Tabassum',  '01614564053', 'female', 'Dhaka',       40, 0.9, 'k', 5,    false),
    (24, 'Mehedi Hasan',      '01615674964', 'male',   'Dhaka',       36, 1.0, 'c', 3,    false),
    (25, 'Lamia Haque',       '01616785875', 'female', 'Dhaka',       30, 0.8, 'w', 1,    false),
    (26, 'Asif Iqbal',        '01617896786', 'male',   'Dhaka',       24, 1.0, 'n', 2,    false),
    (27, 'Puja Das',          '01618907697', 'female', 'Dhaka',       18, 0.9, 'c', 12,   false),
    (28, 'Kamrul Hasan',      '01311018508', 'male',   'Dhaka',       12, 1.0, 'c', 4,    false),
    (29, 'Ishrat Jahan',      '01312129419', 'female', 'Dhaka',        6, 0.8, 'b', -1,   false),
    (30, 'Rezaul Karim',      '01313230320', 'male',   'Dhaka',        1, 0.05,'c', 2,    false),
    (31, 'Sadia Afrin',       '01314341231', 'female', 'Chattogram', 100, 2.0, 'b', NULL, false),
    (32, 'Mizanur Rahman',    '01315452142', 'male',   'Chattogram',  90, 1.5, 'c', NULL, false),
    (33, 'Rafia Sultana',     '01316563053', 'female', 'Chattogram',  85, 1.2, 'c', NULL, false),
    (34, 'Tareq Aziz',        '01317674964', 'male',   'Chattogram',  70, 1.5, 'n', NULL, false),
    (35, 'Shirin Akter',      '01318785875', 'female', 'Chattogram',  50, 1.0, 'w', NULL, false),
    (36, 'Nayeem Uddin',      '01319896786', 'male',   'Chattogram',  20, 0.6, 'c', 31,   false),
    (37, 'Jamal Uddin Ahmed', '01411342231', 'male',   'Sylhet',       80, 1.5, 'c', NULL, false),
    (38, 'Farzana Chowdhury', '01412453142', 'female', 'Sylhet',       60, 1.4, 'b', NULL, false),
    (39, 'Abdul Malik',       '01413564053', 'male',   'Sylhet',       45, 1.0, 'c', NULL, false),
    (40, 'Nazia Rahman',      '01414675964', 'female', 'Sylhet',       30, 1.2, 'n', 37,   false)
  ) AS p(k, name, phone, gender, city, days, w, pref, ref_by, susp)
  JOIN cities c ON c.name = p.city;

  -- Drivers
  CREATE TEMP TABLE _drv AS
  SELECT d.k::int AS k, d.name::text AS name, d.phone::text AS phone, c.id AS city_id, vc.id AS cat_id,
         d.status::text AS status, d.brand::text AS brand, d.model::text AS model, d.myear::int AS myear,
         d.color::text AS color, d.reg::text AS reg, d.w::numeric AS w,
         v_now - make_interval(days => d.days) - (d.k * 5 % 17) * interval '1 hour' AS created_at,
         v_now - make_interval(days => d.days) + interval '2 days' AS active_from,
         CASE WHEN d.idle IS NOT NULL THEN v_now - make_interval(days => d.idle) END AS active_until,
         NULL::bigint AS user_id, NULL::bigint AS vehicle_id, '-infinity'::timestamptz AS busy_until
  FROM (VALUES
    (1,  'Rafiq Islam',    '01810000002', 'Dhaka', 'Car',         'approved',  'Toyota', 'Axio',            2022, 'White',       'DHAKA-METRO-GA-DEMO',          2.0, 150, NULL),
    (2,  'Abdul Karim',    '01811223345', 'Dhaka', 'Car',         'approved',  'Toyota', 'Premio',          2019, 'Silver',      'DHAKA-METRO-GA-15-4821',       1.6, 148, NULL),
    (3,  'Jahangir Alam',  '01812334456', 'Dhaka', 'Car',         'approved',  'Honda',  'Grace Hybrid',    2018, 'Black',       'DHAKA-METRO-GA-13-7392',       1.2, 120, NULL),
    (4,  'Shamim Reza',    '01813445567', 'Dhaka', 'Car',         'approved',  'Toyota', 'Allion',          2020, 'White',       'DHAKA-METRO-CHA-14-5518',      1.3,  45, NULL),
    (5,  'Masud Rana',     '01814556678', 'Dhaka', 'Car Premium', 'approved',  'Toyota', 'Harrier',         2021, 'Pearl White', 'DHAKA-METRO-GHA-11-0273',      1.0, 110, NULL),
    (6,  'Kabir Ahmed',    '01815667789', 'Dhaka', 'Car Premium', 'approved',  'Toyota', 'Crown Athlete',   2019, 'Black',       'DHAKA-METRO-GA-19-3364',       0.8,  32, NULL),
    (7,  'Rubel Mia',      '01816778890', 'Dhaka', 'Bike',        'approved',  'Honda',  'CB Hornet 160R',  2021, 'Red',         'DHAKA-METRO-HA-64-3358',       2.2, 130, NULL),
    (8,  'Sumon Sarker',   '01817889901', 'Dhaka', 'Bike',        'approved',  'Yamaha', 'FZS V3',          2022, 'Blue',        'DHAKA-METRO-HA-71-2040',       1.8, 100, NULL),
    (9,  'Nazmul Huda',    '01818990012', 'Dhaka', 'Bike',        'approved',  'Suzuki', 'Gixxer SF',       2021, 'Black',       'DHAKA-METRO-HA-68-1177',       1.3,  90, NULL),
    (10, 'Faisal Ahmed',   '01819001123', 'Dhaka', 'Bike',        'approved',  'Bajaj',  'Pulsar N160',     2023, 'Black',       'DHAKA-METRO-HA-75-6802',       1.0,  25, NULL),
    (11, 'Milon Hossain',  '01821112234', 'Dhaka', 'Bike',        'approved',  'TVS',    'Apache RTR 160',  2020, 'Red',         'DHAKA-METRO-HA-59-4419',       1.0,  85, 34),
    (12, 'Habibur Rahman', '01822223345', 'Dhaka', 'CNG',         'approved',  'Bajaj',  'RE Compact CNG',  2018, 'Green',       'DHAKA-METRO-THA-11-2654',      1.8, 140, NULL),
    (13, 'Nurul Amin',     '01823334456', 'Dhaka', 'CNG',         'approved',  'Bajaj',  'RE Compact CNG',  2017, 'Green',       'DHAKA-METRO-THA-13-8830',      1.4, 115, NULL),
    (14, 'Shahidul Islam', '01824445567', 'Dhaka', 'CNG',         'approved',  'Bajaj',  'RE Compact CNG',  2019, 'Green',       'DHAKA-METRO-THA-12-5071',      1.2,  95, NULL),
    (15, 'Golam Mostafa',  '01825556678', 'Dhaka', 'CNG',         'approved',  'Bajaj',  'RE Compact CNG',  2020, 'Green',       'DHAKA-METRO-THA-14-3928',      1.0,  60, NULL),
    (16, 'Liton Das',      '01826667789', 'Dhaka', 'Bike',        'pending',   'Honda',  'X-Blade',         2022, 'Grey',        'DHAKA-METRO-HA-77-1590',       0,     3, NULL),
    (17, 'Sagor Ahmed',    '01827778890', 'Dhaka', 'Car',         'pending',   'Toyota', 'Axio',            2016, 'Silver',      'DHAKA-METRO-GA-12-6647',       0,     1, NULL),
    (18, 'Anwar Hossain',  '01828889901', 'Dhaka', 'Bike',        'rejected',  'Yamaha', 'FZ-S',            2015, 'Blue',        'DHAKA-METRO-HA-52-9915',       0,    12, NULL),
    (19, 'Babul Mia',      '01829990012', 'Dhaka', 'CNG',         'suspended', 'Bajaj',  'RE Compact CNG',  2016, 'Green',       'DHAKA-METRO-THA-11-7103',      1.0, 100, 9),
    (20, 'Mohammad Ali',   '01831112234', 'Chattogram', 'Car',    'approved',  'Toyota', 'Premio',          2018, 'White',       'CHATTOGRAM-METRO-GA-11-2345',  1.5,  90, NULL),
    (21, 'Jashim Uddin',   '01832223345', 'Chattogram', 'CNG',    'approved',  'Bajaj',  'RE Compact CNG',  2019, 'Blue',        'CHATTOGRAM-METRO-THA-11-4467', 1.3,  80, NULL),
    (22, 'Enamul Haque',   '01833334456', 'Chattogram', 'Bike',   'approved',  'Honda',  'CB Shine',        2021, 'Red',         'CHATTOGRAM-METRO-HA-13-8821',  1.3,  70, NULL),
    (23, 'Kamal Hossain',  '01834445567', 'Chattogram', 'CNG',    'pending',   'Bajaj',  'RE Compact CNG',  2020, 'Blue',        'CHATTOGRAM-METRO-THA-14-5590', 0,     2, NULL),
    (24, 'Rahim Uddin',    '01835556678', 'Sylhet', 'Bike',       'approved',  'Yamaha', 'FZS V2',          2022, 'Black',       'SYLHET-METRO-HA-11-3306',      1.3,  65, NULL),
    (25, 'Abul Kalam',     '01836667789', 'Sylhet', 'CNG',        'approved',  'Bajaj',  'RE Compact CNG',  2018, 'Green',       'SYLHET-METRO-THA-11-1428',     1.2,  40, NULL)
  ) AS d(k, name, phone, city, category, status, brand, model, myear, color, reg, w, days, idle)
  JOIN cities c ON c.name = d.city
  JOIN vehicle_categories vc ON vc.name = d.category;

  INSERT INTO users (full_name, phone, email, password_hash, gender, preferred_language, status, referral_code,
                     phone_verified_at, last_login_at, created_at, updated_at, suspended_until, suspension_reason)
  SELECT p.name, p.phone, lower(regexp_replace(p.name, '[^A-Za-z]+', '.', 'g')) || '@demo.cholo.local', c_hash,
         p.gender::user_gender, (CASE WHEN p.k % 5 = 0 THEN 'bn' ELSE 'en' END)::preferred_language,
         (CASE WHEN p.susp THEN 'suspended' ELSE 'active' END)::user_status,
         CASE WHEN p.phone = '01710000001' THEN 'NUSRAT26'
              ELSE upper(left(regexp_replace(split_part(p.name, ' ', 1), '[^A-Za-z]', '', 'g'), 6)) || lpad(p.k::text, 2, '0') END,
         p.joined_at, CASE WHEN p.susp THEN v_now - interval '5 days' ELSE v_now - random() * interval '72 hours' END,
         p.joined_at, p.joined_at,
         CASE WHEN p.susp THEN v_now + interval '6 days' END,
         CASE WHEN p.susp THEN 'Repeated no-shows and rider complaints' END
  FROM _pax p
  ON CONFLICT (phone) DO NOTHING;

  INSERT INTO users (full_name, phone, email, password_hash, gender, preferred_language, status, referral_code,
                     phone_verified_at, last_login_at, created_at, updated_at, suspended_until, suspension_reason)
  SELECT d.name, d.phone, lower(regexp_replace(d.name, '[^A-Za-z]+', '.', 'g')) || '.driver@demo.cholo.local', c_hash,
         'male', (CASE WHEN d.k % 4 = 0 THEN 'bn' ELSE 'en' END)::preferred_language,
         (CASE WHEN d.status = 'suspended' THEN 'suspended' ELSE 'active' END)::user_status,
         CASE WHEN d.phone = '01810000002' THEN 'RAFIQ26'
              ELSE upper(left(regexp_replace(split_part(d.name, ' ', 1), '[^A-Za-z]', '', 'g'), 5)) || 'D' || lpad(d.k::text, 2, '0') END,
         d.created_at,
         CASE WHEN d.status IN ('pending', 'rejected') THEN d.created_at + interval '20 minutes'
              WHEN d.status = 'suspended' THEN v_now - interval '9 days'
              WHEN d.active_until IS NOT NULL THEN d.active_until
              ELSE v_now - random() * interval '30 hours' END,
         d.created_at, d.created_at, NULL,
         CASE WHEN d.status = 'suspended' THEN 'Multiple rider complaints, under investigation' END
  FROM _drv d
  ON CONFLICT (phone) DO NOTHING;

  UPDATE _pax SET user_id = u.id FROM users u WHERE u.phone = _pax.phone;
  UPDATE _drv SET user_id = u.id FROM users u WHERE u.phone = _drv.phone;

  INSERT INTO user_roles (user_id, role_id, granted_by)
  SELECT user_id, r_pax, v_super FROM _pax
  UNION ALL SELECT user_id, r_drv, v_super FROM _drv
  ON CONFLICT DO NOTHING;

  INSERT INTO passenger_profiles (user_id, default_city_id, women_only_mode, created_at, updated_at)
  SELECT user_id, city_id, (gender = 'female' AND k IN (5, 9, 25, 31)), joined_at, joined_at FROM _pax
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO driver_profiles (user_id, nid_number, license_number, license_expiry, verification_status,
                               verified_by, verified_at, rejection_reason, created_at, updated_at)
  SELECT d.user_id,
         CASE WHEN d.k % 2 = 0 THEN '19' || lpad(((d.k * 7919317 + 13579) % 100000000)::text, 8, '0')
              ELSE '19' || lpad(((d.k * 79193170 + 24680135) % 100000000000)::text, 11, '0') END,
         (CASE d.city_id WHEN v_dhaka THEN 'DHK' WHEN v_ctg THEN 'CTG' ELSE 'SYL' END) || '-' || lpad((1000000 + d.k * 7333)::text, 7, '0'),
         CASE WHEN d.k = 9 THEN current_date + 14 ELSE current_date + 400 + d.k * 37 END,
         d.status::driver_verification_status,
         CASE WHEN d.status = 'pending' THEN NULL ELSE v_super END,
         CASE WHEN d.status = 'pending' THEN NULL ELSE d.created_at + interval '2 days' END,
         CASE WHEN d.status = 'rejected' THEN 'NID and driving licence details do not match' END,
         d.created_at, d.created_at
  FROM _drv d
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO vehicles (driver_id, category_id, registration_no, brand, model, model_year, color,
                        verification_status, is_active, rejection_reason, created_at, updated_at)
  SELECT d.user_id, d.cat_id, d.reg, d.brand, d.model, d.myear, d.color,
         (CASE d.status WHEN 'pending' THEN 'pending' WHEN 'rejected' THEN 'rejected' ELSE 'approved' END)::vehicle_verification_status,
         true,
         CASE WHEN d.status = 'rejected' THEN 'Registration certificate has expired' END,
         d.created_at + interval '1 hour', d.created_at + interval '1 hour'
  FROM _drv d
  ON CONFLICT (registration_no) DO NOTHING;

  INSERT INTO vehicles (driver_id, category_id, registration_no, brand, model, model_year, color,
                        verification_status, is_active, created_at, updated_at)
  SELECT d.user_id, c_car, 'DHAKA-METRO-GA-17-9046', 'Toyota', 'Corolla Axio', 2021, 'White', 'pending', false,
         v_now - interval '2 days', v_now - interval '2 days'
  FROM _drv d WHERE d.k = 2
  ON CONFLICT (registration_no) DO NOTHING;

  UPDATE _drv SET vehicle_id = v.id FROM vehicles v WHERE v.registration_no = _drv.reg;
  UPDATE driver_profiles dp SET active_vehicle_id = d.vehicle_id
  FROM _drv d WHERE dp.user_id = d.user_id AND dp.active_vehicle_id IS NULL;

  INSERT INTO driver_documents (driver_id, doc_type, doc_number, file_url, issue_date, expiry_date, status,
                                reviewed_by, reviewed_at, rejection_reason, uploaded_at)
  SELECT d.user_id, t.doc_type::driver_doc_type,
         CASE t.doc_type WHEN 'license' THEN dp.license_number WHEN 'nid' THEN dp.nid_number
              WHEN 'photo' THEN 'PHOTO-' || lpad(d.k::text, 3, '0') ELSE 'PC-2026-' || lpad((d.k * 137)::text, 5, '0') END,
         'https://example.com/cholo/demo/' || t.doc_type || '-' || d.k || '.jpg',
         (d.created_at)::date - 300,
         CASE t.doc_type WHEN 'license' THEN dp.license_expiry WHEN 'police_clearance' THEN current_date + 365 END,
         s.status::document_status,
         CASE WHEN s.status = 'pending' THEN NULL ELSE v_super END,
         CASE WHEN s.status = 'pending' THEN NULL ELSE d.created_at + interval '2 days' END,
         CASE WHEN s.status = 'rejected' AND t.doc_type = 'photo' THEN 'Face is not clearly visible'
              WHEN s.status = 'rejected' THEN 'Name on the licence does not match the NID' END,
         d.created_at + interval '10 minutes'
  FROM _drv d
  JOIN driver_profiles dp ON dp.user_id = d.user_id
  CROSS JOIN (VALUES ('license'), ('nid'), ('photo'), ('police_clearance')) AS t(doc_type)
  CROSS JOIN LATERAL (SELECT CASE
      WHEN d.status IN ('approved', 'suspended') THEN 'approved'
      WHEN d.status = 'pending' THEN CASE WHEN t.doc_type = 'photo' AND d.k = 17 THEN 'rejected' ELSE 'pending' END
      ELSE CASE WHEN t.doc_type = 'license' THEN 'rejected' ELSE 'approved' END END AS status) s
  WHERE NOT (d.k = 16 AND t.doc_type = 'police_clearance')
    AND NOT EXISTS (SELECT 1 FROM driver_documents x WHERE x.driver_id = d.user_id AND x.doc_type::text = t.doc_type);

  INSERT INTO vehicle_documents (vehicle_id, doc_type, doc_number, file_url, issue_date, expiry_date, status,
                                 reviewed_by, reviewed_at, rejection_reason, uploaded_at)
  SELECT d.vehicle_id, t.doc_type::vehicle_doc_type,
         upper(left(t.doc_type, 3)) || '-' || lpad((d.k * 911)::text, 6, '0'),
         'https://example.com/cholo/demo/vehicle-' || t.doc_type || '-' || d.k || '.jpg',
         (d.created_at)::date - 200,
         CASE WHEN d.k = 8 AND t.doc_type = 'tax_token' THEN current_date + 9
              ELSE current_date + 60 + ((d.k * 53) % 420) END,
         s.status::document_status,
         CASE WHEN s.status = 'pending' THEN NULL ELSE v_super END,
         CASE WHEN s.status = 'pending' THEN NULL ELSE d.created_at + interval '2 days' END,
         CASE WHEN s.status = 'rejected' THEN 'Registration certificate has expired' END,
         d.created_at + interval '1 hour'
  FROM _drv d
  CROSS JOIN (VALUES ('registration'), ('fitness'), ('insurance'), ('tax_token')) AS t(doc_type)
  CROSS JOIN LATERAL (SELECT CASE
      WHEN d.status IN ('approved', 'suspended') THEN 'approved'
      WHEN d.status = 'pending' THEN 'pending'
      ELSE CASE WHEN t.doc_type = 'registration' THEN 'rejected' ELSE 'approved' END END AS status) s
  WHERE NOT (d.k = 16 AND t.doc_type = 'insurance') AND NOT (d.k = 23 AND t.doc_type = 'fitness')
    AND NOT EXISTS (SELECT 1 FROM vehicle_documents x WHERE x.vehicle_id = d.vehicle_id AND x.doc_type::text = t.doc_type);

  INSERT INTO vehicle_documents (vehicle_id, doc_type, doc_number, file_url, issue_date, expiry_date, status, uploaded_at)
  SELECT v.id, t.doc_type::vehicle_doc_type, 'REG-NEW-' || t.doc_type,
         'https://example.com/cholo/demo/vehicle-' || t.doc_type || '-2b.jpg', current_date - 30, current_date + 365,
         'pending', v_now - interval '2 days'
  FROM vehicles v CROSS JOIN (VALUES ('registration'), ('fitness')) AS t(doc_type)
  WHERE v.registration_no = 'DHAKA-METRO-GA-17-9046'
    AND NOT EXISTS (SELECT 1 FROM vehicle_documents x WHERE x.vehicle_id = v.id);

  UPDATE driver_payout_accounts SET account_no = '01810000002'
  WHERE driver_id = (SELECT user_id FROM _drv WHERE k = 1) AND account_type = 'bkash' AND account_no IS NULL;

  INSERT INTO driver_payout_accounts (driver_id, account_type, account_name, account_no, account_no_masked,
                                      bank_name, is_default, is_verified, created_at)
  SELECT d.user_id, 'bkash', d.name, d.phone, repeat('*', 7) || right(d.phone, 4), NULL, true, true, d.created_at + interval '3 days'
  FROM _drv d
  WHERE d.status IN ('approved', 'suspended')
    AND NOT EXISTS (SELECT 1 FROM driver_payout_accounts x WHERE x.driver_id = d.user_id AND x.is_default);

  INSERT INTO driver_payout_accounts (driver_id, account_type, account_name, account_no, account_no_masked,
                                      bank_name, is_default, is_verified, created_at)
  SELECT d.user_id, x.atype::payout_account_type, d.name, x.acc, repeat('*', greatest(length(x.acc) - 4, 4)) || right(x.acc, 4),
         x.bank, false, x.verified, v_now - interval '20 days'
  FROM _drv d
  JOIN (VALUES
    (2,  'nagad', '01811223345',   NULL,                true),
    (3,  'bank',  '1201510234567', 'Dutch-Bangla Bank', true),
    (7,  'nagad', '01816778890',   NULL,                true),
    (12, 'bank',  '1052210998765', 'BRAC Bank',         true),
    (15, 'nagad', '01825556678',   NULL,                false),
    (20, 'bank',  '2050430100182', 'City Bank',         true)
  ) AS x(k, atype, acc, bank, verified) ON x.k = d.k;

  INSERT INTO referrals (referrer_id, referee_id, code_used, status, created_at)
  SELECT u.id, p.user_id, u.referral_code, 'pending', p.joined_at + interval '5 minutes'
  FROM _pax p
  JOIN users u ON u.id = CASE WHEN p.ref_by > 0
                              THEN (SELECT x.user_id FROM _pax x WHERE x.k = p.ref_by)
                              ELSE (SELECT y.user_id FROM _drv y WHERE y.k = -p.ref_by) END
  WHERE p.ref_by IS NOT NULL
  ON CONFLICT (referee_id) DO NOTHING;

  -- Promotions
  INSERT INTO promo_codes
    (code, description, promo_type, value, max_discount, min_fare, usage_limit_total, usage_limit_per_user,
     first_ride_only, city_id, category_id, valid_from, valid_until, is_active, created_by, created_at)
  SELECT p.code, p.descr, p.ptype::promo_type, p.val::numeric, p.maxd::numeric, p.minf::numeric, p.ltotal::int, p.luser::smallint,
         p.first_only, c.id, vc.id, v_now - make_interval(days => p.from_days),
         CASE WHEN p.until_days IS NULL THEN NULL ELSE v_now + make_interval(days => p.until_days) END,
         p.active, v_super, v_now - make_interval(days => p.from_days)
  FROM (VALUES
    ('WELCOME50', 'Flat 50 BDT off your first Cholo ride',        'fixed_amount', 50, NULL, 100, NULL, 1,  true,  NULL,         NULL,          110, NULL, true),
    ('CHOLO20',   '20% off any ride, up to 60 BDT',               'percentage',   20, 60,   150, 3000, 4,  false, NULL,         NULL,           80, 40,   true),
    ('BIKE15',    '15% off Bike rides, up to 30 BDT',             'percentage',   15, 30,    60, NULL, 10, false, NULL,         'Bike',         60, 30,   true),
    ('WEEKEND25', '25% off Car rides, up to 80 BDT',              'percentage',   25, 80,   200, NULL, 3,  false, NULL,         'Car',          50, 20,   true),
    ('EID2026',   'Eid special: 30% off, up to 100 BDT',          'percentage',   30, 100,  100, 500,  2,  false, NULL,         NULL,           75, -50,  false),
    ('SYLHET25',  'Sylhet launch offer: 25 BDT off',              'fixed_amount', 25, NULL,  90, NULL, 6,  false, 'Sylhet',     NULL,           45, 45,   true),
    ('CTG20',     'Chattogram: 20 BDT off every ride',            'fixed_amount', 20, NULL,  80, NULL, 6,  false, 'Chattogram', NULL,           55, 60,   true),
    ('RAINYDAY',  'Rainy day special: 10% off, up to 40 BDT',     'percentage',   10, 40,    80, NULL, 5,  false, NULL,         NULL,           20, 10,   true),
    ('LOYAL100',  '100 BDT off Premium rides above 400 BDT',      'fixed_amount', 100, NULL, 400, 100, 1,  false, NULL,         'Car Premium',  30, 30,   true)
  ) AS p(code, descr, ptype, val, maxd, minf, ltotal, luser, first_only, city, category, from_days, until_days, active)
  LEFT JOIN cities c ON c.name = p.city
  LEFT JOIN vehicle_categories vc ON vc.name = p.category
  ON CONFLICT (code) DO NOTHING;

  -- Saved places, emergency contacts, payment methods
  INSERT INTO saved_places (user_id, label, address_text, lat, lng, is_default, created_at)
  SELECT p.user_id, s.label,
         l.name || ', ' || l.area || ', ' || (SELECT name FROM cities WHERE id = l.city_id),
         l.lat, l.lng, s.label = 'Home', p.joined_at + interval '1 day'
  FROM _pax p
  CROSS JOIN (VALUES ('Home'), ('Work'), ('Family')) AS s(label)
  CROSS JOIN LATERAL (SELECT x.* FROM _loc x WHERE x.city_id = p.city_id AND s.label IS NOT NULL
                      ORDER BY -ln(1 - random()) / x.w LIMIT 1) l
  WHERE (s.label = 'Home' AND p.k % 4 <> 3) OR (s.label = 'Work' AND p.k % 3 <> 0) OR (s.label = 'Family' AND p.k % 5 = 0)
  ON CONFLICT (user_id, label) DO NOTHING;

  INSERT INTO emergency_contacts (user_id, name, phone, relationship, priority)
  SELECT p.user_id,
         (ARRAY['Farhana Jahan','Md. Alamgir Hossain','Shirin Sultana','Rokeya Begum','Anwar Hossain','Mahbuba Akter','Kamal Uddin'])[1 + p.k % 7],
         '0169' || lpad(((p.k * 7654321) % 10000000)::text, 7, '0'),
         (ARRAY['Sister','Father','Mother','Spouse','Brother','Friend','Uncle'])[1 + p.k % 7],
         CASE WHEN p.k = 1 THEN 2 ELSE 1 END
  FROM _pax p WHERE p.k % 3 <> 0
  ON CONFLICT (user_id, phone) DO NOTHING;

  INSERT INTO emergency_contacts (user_id, name, phone, relationship, priority)
  SELECT d.user_id, 'Rahima Begum', '0168' || lpad(((d.k * 5432107) % 10000000)::text, 7, '0'), 'Wife', 1
  FROM _drv d WHERE d.status = 'approved' AND d.k % 2 = 1
  ON CONFLICT (user_id, phone) DO NOTHING;

  INSERT INTO payment_methods (user_id, method_type, provider, display_label, gateway_token, is_default, is_verified, created_at)
  SELECT p.user_id, m.mt::payment_instrument_type, m.pv::payment_instrument_provider,
         CASE m.mt WHEN 'bkash' THEN 'bKash ' || left(p.phone, 3) || '****' || right(p.phone, 3)
                   WHEN 'nagad' THEN 'Nagad ' || left(p.phone, 3) || '****' || right(p.phone, 3)
                   ELSE 'Visa **** ' || lpad((4000 + p.k * 37)::text, 4, '0') END,
         'demo_tok_' || md5(p.phone || m.mt), true, true, p.joined_at + interval '3 days'
  FROM _pax p
  CROSS JOIN LATERAL (SELECT CASE p.pref WHEN 'b' THEN 'bkash' WHEN 'n' THEN 'nagad' ELSE 'card' END AS mt,
                             CASE p.pref WHEN 'b' THEN 'bkash' WHEN 'n' THEN 'nagad' ELSE 'sslcommerz' END AS pv) m
  WHERE p.pref IN ('b', 'n', 'k');

  -- Wallet bookkeeping for the timeline replay
  CREATE TEMP TABLE _bal AS
  SELECT w.user_id, w.id AS wallet_id, w.balance AS bal, '-infinity'::timestamptz AS last_ts FROM wallets w;
  CREATE UNIQUE INDEX ON _bal (user_id);

  CREATE TEMP TABLE _surged (zone_id bigint, day date, morning boolean, mult numeric, ts timestamptz);




  -- Event queue
  CREATE TEMP TABLE _ev (
    seq bigint GENERATED ALWAYS AS IDENTITY, ts timestamptz NOT NULL, kind text NOT NULL,
    outcome text, city_id smallint, cat_id smallint, data jsonb);
  CREATE INDEX ON _ev (ts, seq);



  INSERT INTO _ev (ts, kind, outcome, city_id, cat_id)
  SELECT x.ts, 'ride', x.outcome, (x.m).o_city, (x.m).o_cat
  FROM (
    SELECT cholo_demo_seed.d_ts(v_today, v_now) AS ts, o.outcome,
           cholo_demo_seed.d_mix(v_dhaka, v_ctg, v_syl, c_bike, c_cng, c_car, c_prem) AS m
    FROM (VALUES ('completed', 600), ('cancel_pax', 30), ('cancel_drv', 14), ('cancel_sys', 3),
                 ('expired', 18), ('cancel_pre', 9)) AS o(outcome, n)
    CROSS JOIN LATERAL generate_series(1, o.n) g
  ) x;

  INSERT INTO _ev (ts, kind, outcome, city_id, cat_id)
  SELECT x.ts, 'ride', 'completed', (x.m).o_city, (x.m).o_cat
  FROM (
    SELECT cholo_demo_seed.d_ts_old(v_today) AS ts, cholo_demo_seed.d_mix(v_dhaka, v_ctg, v_syl, c_bike, c_cng, c_car, c_prem) AS m
    FROM generate_series(1, 130) g
  ) x;

  INSERT INTO _ev (ts, kind, outcome, city_id, cat_id, data) VALUES
    (v_now - interval '9 minutes',   'ride', 'live_inprogress', v_dhaka, c_car,  NULL),
    (v_now - interval '4 minutes',   'ride', 'live_inprogress', v_dhaka, c_bike, NULL),
    (v_now - interval '7 minutes',   'ride', 'live_inprogress', v_ctg,   c_cng,  NULL),
    (v_now - interval '2 minutes',   'ride', 'live_arrived',    v_dhaka, c_cng,  NULL),
    (v_now - interval '3 minutes',   'ride', 'live_assigned',   v_dhaka, c_car,  NULL),
    (v_now - interval '1 minute',    'ride', 'live_assigned',   v_syl,   c_bike, NULL),
    (v_now - interval '40 seconds',  'ride', 'live_searching',  v_dhaka, c_bike, NULL),
    (v_now - interval '15 seconds',  'ride', 'live_pending',    v_dhaka, c_car,  NULL),
    (v_now - interval '20 minutes',  'ride', 'live_scheduled',  v_dhaka, c_car,  jsonb_build_object('at', v_now + interval '3 hours')),
    (v_now - interval '35 minutes',  'ride', 'live_scheduled',  v_dhaka, c_car,
       jsonb_build_object('at', ((v_today + 1)::timestamp + interval '6 hours 30 minutes') AT TIME ZONE 'Asia/Dhaka')),
    (v_now - interval '25 minutes',  'ride', 'unpaid_bkash',    v_dhaka, c_car,  NULL),
    (v_now - interval '2 hours',     'ride', 'unpaid_wallet',   v_dhaka, c_cng,  NULL),
    (v_now - interval '210 minutes', 'ride', 'unpaid_card',     v_dhaka, c_car,  NULL);

  -- Voluntary wallet top-ups, cashback and manual credits
  INSERT INTO _ev (ts, kind, data)
  SELECT t.ts, 'topup', jsonb_build_object('user', t.user_id, 'amount', t.amount)
  FROM (
    SELECT p.user_id, p.joined_at, p.active_until, cholo_demo_seed.d_when(v_today, 2, 55) AS ts,
           (ARRAY[500, 1000, 1500, 2000])[1 + floor(random() * 4)::int] AS amount
    FROM _pax p
    CROSS JOIN LATERAL generate_series(1, CASE WHEN p.pref = 'w' THEN 4 WHEN p.pref IN ('b', 'n', 'k') AND p.k % 3 = 0 THEN 1 ELSE 0 END) g
  ) t
  WHERE t.ts > t.joined_at + interval '2 days' AND (t.active_until IS NULL OR t.ts < t.active_until);

  INSERT INTO _ev (ts, kind, data)
  SELECT greatest(p.joined_at + interval '3 days', v_now - random() * interval '40 days'), 'credit',
         jsonb_build_object('user', p.user_id, 'amount', c.amount, 'type', c.txn_type, 'ref', c.ref, 'note', c.note)
  FROM (SELECT * FROM _pax WHERE k <= 30 AND NOT susp ORDER BY random() LIMIT 9) p
  CROSS JOIN LATERAL (SELECT * FROM (VALUES
      ('promo_credit', 'promo',  50,  'Cashback for completing 5 rides this week'),
      ('promo_credit', 'promo',  100, 'Eid cashback'),
      ('adjustment',   'manual', 80,  'Goodwill credit from support for a delayed pickup'),
      ('promo_credit', 'promo',  30,  'Rainy day cashback')) AS q(txn_type, ref, amount, note)
    WHERE p.k > 0 ORDER BY random() LIMIT 1) c;

  -- Withdrawal requests (history, then the live queue)
  INSERT INTO _ev (ts, kind, data)
  SELECT w.ts, 'wd_request',
         jsonb_build_object('driver', w.user_id, 'want', (5 + floor(random() * 26))::int * 100,
                            'outcome', CASE WHEN w.n IN (4, 17, 26, 39) THEN 'rejected' WHEN w.n IN (11, 32) THEN 'failed' ELSE 'paid' END)
  FROM (SELECT x.*, row_number() OVER (ORDER BY x.ts) AS n FROM (
          SELECT d.user_id, ((v_today - g.d)::timestamp + make_interval(hours => 10 + (g.d % 5), mins => (g.d * 7 + d.k * 3) % 60))
                        AT TIME ZONE 'Asia/Dhaka' AS ts, d.active_from
          FROM _drv d CROSS JOIN LATERAL (VALUES (49), (42), (35), (28), (21), (14), (8)) g(d)
          WHERE d.k IN (1, 2, 3, 5, 7, 8, 9, 12, 13, 14, 20, 21, 22, 24)
            AND (hashtext(d.k::text || '-' || g.d::text) % 100 + 100) % 100 < 60
        ) x WHERE x.ts > x.active_from + interval '9 days') w;

  INSERT INTO _ev (ts, kind, data)
  SELECT v_now - x.ago, 'wd_request',
         jsonb_build_object('driver', d.user_id, 'want', x.want, 'outcome', x.outcome)
  FROM (VALUES
    (1,  interval '3 hours',  1200, 'requested'),
    (7,  interval '7 hours',   900, 'requested'),
    (8,  interval '11 hours', 1500, 'requested'),
    (12, interval '19 hours', 1000, 'requested'),
    (2,  interval '26 hours', 2000, 'requested'),
    (20, interval '30 hours',  800, 'requested'),
    (9,  interval '40 hours',  700, 'approved'),
    (13, interval '52 hours', 1100, 'approved'),
    (3,  interval '62 hours', 1300, 'paid'),
    (7,  interval '4 days',    800, 'failed'),
    (12, interval '6 days',    700, 'rejected')
  ) AS x(k, ago, want, outcome)
  JOIN _drv d ON d.k = x.k;


  -- Replay the timeline in order: rides, payments, ledger, withdrawals, refunds
  DECLARE
    ev record; l1 record; l2 record; l3 record; pax record; drv record; promo record; tf record;
    f record; fe record; cm record; b record; acct record; rf record;
    v_out text; v_ts timestamptz; v_city smallint; v_cat smallint; v_cityname text;
    v_hour int; v_stop boolean; v_early boolean; v_frac numeric; r numeric;
    v_hav numeric; v_route numeric; v_km numeric; v_km_act numeric; v_dur numeric; v_dur_act numeric; v_speed numeric;
    v_plat numeric; v_plng numeric; v_dlat numeric; v_dlng numeric; v_elat numeric; v_elng numeric;
    v_eta numeric; v_wait numeric; v_accept numeric;
    v_req timestamptz; v_asg timestamptz; v_arr timestamptz; v_start timestamptz; v_end timestamptz; v_pay_at timestamptz;
    v_zone bigint; v_mult numeric; v_h int;
    v_pay text; v_pre numeric; v_disc numeric; v_total numeric; v_gross numeric; v_comm numeric; v_net numeric; v_delta numeric;
    v_promo_id bigint; v_has_done boolean;
    v_rstatus ride_request_status; v_tstatus trip_status; v_have_driver boolean;
    v_req_id bigint; v_tid bigint; v_pay_id bigint; v_has_trip boolean;
    v_score int; v_amt numeric; v_status text; v_proc timestamptz; v_wid bigint; v_ref text;
    v_dtype text; v_dstatus text; v_dby bigint; v_dcreated timestamptz; v_dres timestamptz; v_damt numeric; v_did bigint; v_dno text; v_dref numeric; v_dnote text; v_ddesc text;
    v_last text; v_conf boolean; v_win_end timestamptz; v_slat numeric; v_slng numeric; v_saddr text;
    c_pos text[] := ARRAY['Very polite driver and a smooth ride.', 'Reached on time, thank you!', 'Clean car and very safe driving.',
      'Great experience, will book again.', 'Driver knew the shortest route and saved me time.', 'Friendly and professional.',
      'Comfortable ride, the AC worked well.', 'Followed traffic rules, I felt very safe.',
      'দারুণ সার্ভিস, ধন্যবাদ!', 'খুবই ভালো ড্রাইভার, সময়মতো পৌঁছেছেন।'];
    c_mid text[] := ARRAY['Ride was okay but the driver took a longer route.', 'Driver was a little late but polite.',
      'Average experience.', 'ভালো ছিল, তবে একটু দেরি হয়েছে।'];
    c_low text[] := ARRAY['Driver was rude and kept asking me to cancel.', 'Took a much longer route than the app showed.',
      'The vehicle was not clean.', 'Driver was on the phone during the trip.', 'রাস্তা ঘুরিয়ে নিয়েছে, ভাড়া বেশি এসেছে।'];
    c_pax text[] := ARRAY['Respectful rider.', 'Was ready at the pickup point on time.', 'Good passenger, thank you.', 'Very polite.'];
    t_pos text[] := ARRAY['Polite driver', 'Clean vehicle', 'Safe driving', 'Great navigation', 'On time'];
    t_neg text[] := ARRAY['Late arrival', 'Rude behavior', 'Long route', 'Unsafe driving'];
    f_reasons text[] := ARRAY['Insufficient balance', 'Payment cancelled by user', 'OTP timed out', 'Card declined by issuer'];
    q_pax text[] := ARRAY['I am at the pickup point', 'Please wait 2 minutes', 'I am wearing a blue shirt', 'Where are you now?'];
    q_drv text[] := ARRAY['I have arrived', 'On my way, 3 minutes away', 'I am near the main gate', 'Please share your exact location'];
    w_rej text[] := ARRAY['Payout account name does not match your profile', 'Amount is above your weekly withdrawal limit', 'Please clear pending commission before withdrawing'];
    w_fail text[] := ARRAY['Receiving bank returned the transfer', 'Wallet account is inactive'];
  BEGIN
    ALTER TABLE trips DISABLE TRIGGER trg_log_trip_status_insert;
    ALTER TABLE trips DISABLE TRIGGER trg_log_trip_status_update;

    LOOP
      DELETE FROM _ev WHERE seq = (SELECT e.seq FROM _ev e ORDER BY e.ts, e.seq LIMIT 1) RETURNING * INTO ev;
      EXIT WHEN NOT FOUND;

      IF ev.kind = 'topup' THEN
        PERFORM cholo_demo_seed.d_topup((ev.data->>'user')::bigint, (ev.data->>'amount')::numeric, ev.ts);
        CONTINUE;
      ELSIF ev.kind = 'credit' THEN
        PERFORM cholo_demo_seed.d_txn((ev.data->>'user')::bigint, ev.ts, (ev.data->>'type')::wallet_txn_type, 'credit',
                              (ev.data->>'amount')::numeric, (ev.data->>'ref')::wallet_txn_reference_type, NULL,
                              'demo-credit-' || ev.seq, ev.data->>'note');
        INSERT INTO notifications (user_id, category, title, body, created_at, read_at)
        VALUES ((ev.data->>'user')::bigint, 'promo', (ev.data->>'amount') || ' BDT added to your wallet', ev.data->>'note',
                ev.ts, ev.ts + interval '3 hours');
        CONTINUE;
      ELSIF ev.kind = 'wd_return' THEN
        PERFORM cholo_demo_seed.d_txn((ev.data->>'driver')::bigint, ev.ts, 'adjustment', 'credit', (ev.data->>'amount')::numeric,
                              'withdrawal', (ev.data->>'wid')::bigint, ev.data->>'key', ev.data->>'note');
        CONTINUE;
      ELSIF ev.kind = 'wd_request' THEN
        SELECT * INTO b FROM _bal WHERE user_id = (ev.data->>'driver')::bigint;
        v_amt := least((ev.data->>'want')::numeric, floor(b.bal * 0.85 / 50) * 50);
        IF v_amt < 300 THEN CONTINUE; END IF;
        SELECT id, account_type INTO acct FROM driver_payout_accounts
        WHERE driver_id = (ev.data->>'driver')::bigint AND is_verified ORDER BY is_default DESC, id LIMIT 1;
        IF NOT FOUND THEN CONTINUE; END IF;
        v_status := ev.data->>'outcome';
        v_proc := CASE v_status
                    WHEN 'requested' THEN NULL
                    WHEN 'approved' THEN ev.ts + interval '2 hours'
                    WHEN 'rejected' THEN ev.ts + make_interval(hours => 2 + floor(random() * 18)::int)
                    WHEN 'failed' THEN ev.ts + make_interval(hours => 6 + floor(random() * 24)::int)
                    ELSE least(ev.ts + make_interval(hours => 4 + floor(random() * 30)::int), v_now - interval '1 minute') END;
        v_ref := CASE WHEN v_status = 'paid' THEN
                   (CASE acct.account_type WHEN 'bank' THEN 'BANK-' WHEN 'nagad' THEN 'NAGAD-' ELSE 'BKASH-' END)
                   || upper(substr(md5(random()::text), 1, 10)) END;
        INSERT INTO withdrawals (driver_id, payout_account_id, amount, fee, status, gateway_ref, processed_by,
                                 rejection_reason, requested_at, processed_at)
        VALUES ((ev.data->>'driver')::bigint, acct.id, v_amt, 0, v_status::withdrawal_status, v_ref,
                CASE WHEN v_status = 'requested' THEN NULL ELSE v_fin END,
                CASE v_status WHEN 'rejected' THEN w_rej[1 + floor(random() * 3)::int]
                              WHEN 'failed' THEN w_fail[1 + floor(random() * 2)::int] END,
                ev.ts, v_proc)
        RETURNING id INTO v_wid;
        PERFORM cholo_demo_seed.d_txn((ev.data->>'driver')::bigint, ev.ts, 'withdrawal', 'debit', v_amt, 'withdrawal', v_wid,
                              'withdrawal-request-' || v_wid, NULL);
        IF v_status IN ('rejected', 'failed') THEN
          INSERT INTO _ev (ts, kind, data)
          VALUES (v_proc, 'wd_return', jsonb_build_object('driver', (ev.data->>'driver')::bigint, 'amount', v_amt, 'wid', v_wid,
                  'key', CASE v_status WHEN 'rejected' THEN 'withdrawal-reject-' ELSE 'withdrawal-failed-' END || v_wid,
                  'note', CASE v_status WHEN 'rejected' THEN 'Withdrawal rejected, hold reversed' ELSE 'Payout failed, amount returned' END));
        END IF;
        CONTINUE;
      ELSIF ev.kind = 'refund' THEN
        v_amt := (ev.data->>'amount')::numeric;
        PERFORM cholo_demo_seed.d_txn((ev.data->>'pax')::bigint, ev.ts, 'refund', 'credit', v_amt, 'payment', (ev.data->>'payment')::bigint,
                              'dispute-refund-' || (ev.data->>'dispute'), 'Refund for ' || (ev.data->>'dispute_no'));
        v_delta := round(v_amt * (ev.data->>'net')::numeric / (ev.data->>'gross')::numeric, 2);
        IF v_delta > 0 THEN
          PERFORM cholo_demo_seed.d_fund((ev.data->>'driver')::bigint, v_delta, ev.ts);
          PERFORM cholo_demo_seed.d_txn((ev.data->>'driver')::bigint, ev.ts, 'adjustment', 'debit', v_delta, 'payment',
                                (ev.data->>'payment')::bigint, 'dispute-clawback-' || (ev.data->>'dispute'),
                                'Your share of the refund for ' || (ev.data->>'dispute_no'));
        END IF;
        UPDATE payments SET status = 'refunded', refund_amount = v_amt, refunded_at = ev.ts WHERE id = (ev.data->>'payment')::bigint;
        UPDATE trips SET payment_status = 'refunded' WHERE id = (ev.data->>'trip')::bigint;
        INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
        VALUES ((ev.data->>'pax')::bigint, 'payment', 'Dispute ' || (ev.data->>'dispute_no') || ' was resolved with a refund to your wallet',
                v_amt || ' BDT has been added to your wallet.', jsonb_build_object('disputeId', ev.data->>'dispute'), ev.ts, ev.ts + interval '2 hours');
        CONTINUE;
      END IF;

      -- Ride events
      v_out := ev.outcome; v_ts := ev.ts; v_city := ev.city_id; v_cat := ev.cat_id;
      SELECT name INTO v_cityname FROM cities WHERE id = v_city;
      v_hour := extract(hour FROM v_ts AT TIME ZONE 'Asia/Dhaka')::int;

      SELECT * INTO l1 FROM _loc WHERE city_id = v_city ORDER BY -ln(1 - random()) / w LIMIT 1;
      SELECT x.* INTO l2 FROM _loc x
      WHERE x.city_id = v_city AND x.id <> l1.id
        AND cholo_demo_seed.d_hav(l1.lat, l1.lng, x.lat, x.lng) BETWEEN 1.3 AND (CASE WHEN v_cat = c_bike THEN 14 WHEN v_cat = c_cng THEN 12 ELSE 26 END)
      ORDER BY -ln(1 - random()) / (x.w * exp(-cholo_demo_seed.d_hav(l1.lat, l1.lng, x.lat, x.lng) / 7)) LIMIT 1;
      IF NOT FOUND THEN
        SELECT x.* INTO l2 FROM _loc x WHERE x.city_id = v_city AND x.id <> l1.id
          AND cholo_demo_seed.d_hav(l1.lat, l1.lng, x.lat, x.lng) >= 1.3 ORDER BY random() LIMIT 1;
        IF NOT FOUND THEN CONTINUE; END IF;
      END IF;
      v_plat := round(l1.lat + (random()::numeric - 0.5) * 0.003, 6); v_plng := round(l1.lng + (random()::numeric - 0.5) * 0.003, 6);
      v_dlat := round(l2.lat + (random()::numeric - 0.5) * 0.003, 6); v_dlng := round(l2.lng + (random()::numeric - 0.5) * 0.003, 6);
      v_hav := cholo_demo_seed.d_hav(v_plat, v_plng, v_dlat, v_dlng);
      v_route := v_hav; v_stop := false;
      IF v_out = 'completed' AND v_city = v_dhaka AND v_cat IN (c_car, c_cng) AND v_hav > 3 AND random() < 0.13 THEN
        SELECT x.* INTO l3 FROM _loc x
        WHERE x.city_id = v_city AND x.id NOT IN (l1.id, l2.id)
          AND cholo_demo_seed.d_hav(v_plat, v_plng, x.lat, x.lng) + cholo_demo_seed.d_hav(x.lat, x.lng, v_dlat, v_dlng) < 1.5 * v_hav
        ORDER BY random() LIMIT 1;
        v_stop := FOUND;
        IF v_stop THEN
          v_slat := l3.lat; v_slng := l3.lng; v_saddr := cholo_demo_seed.d_addr(l3.name, l3.area, v_cityname);
          v_route := cholo_demo_seed.d_hav(v_plat, v_plng, v_slat, v_slng) + cholo_demo_seed.d_hav(v_slat, v_slng, v_dlat, v_dlng);
        END IF;
      END IF;
      v_km := round(v_route * (1.22 + random()::numeric * 0.2), 2);
      v_speed := (CASE WHEN v_cat = c_bike THEN 24 WHEN v_cat = c_cng THEN 17 ELSE 15 END)
                 * (CASE WHEN v_city = v_dhaka THEN 1.0 ELSE 1.15 END)
                 * (CASE WHEN v_hour IN (8, 9, 10, 17, 18, 19, 20) THEN 0.72 WHEN v_hour >= 23 OR v_hour <= 5 THEN 1.25 ELSE 1.0 END)
                 * (0.85 + random() * 0.3);
      v_dur := greatest(5, round(v_km / v_speed * 60));
      v_early := v_out = 'completed' AND v_km > 3 AND random() < 0.026;
      v_km_act := round(v_km * (0.97 + random()::numeric * 0.08), 2);
      v_dur_act := greatest(4, round(v_dur * (0.9 + random()::numeric * 0.3)));
      v_frac := 1;
      IF v_early THEN
        v_frac := 0.4 + random()::numeric * 0.45;
        v_km_act := round(v_km_act * v_frac, 2);
        v_dur_act := greatest(3, round(v_dur_act * v_frac));
        v_elat := round(v_plat + (v_dlat - v_plat) * v_frac, 6);
        v_elng := round(v_plng + (v_dlng - v_plng) * v_frac, 6);
      END IF;
      v_eta := CASE WHEN v_cat = c_bike THEN 2 + random() * 6 ELSE 3 + random() * 10 END;
      v_wait := 1 + random() * 3.5;
      v_accept := 8 + random() * 70;

      v_req := NULL; v_asg := NULL; v_arr := NULL; v_start := NULL; v_end := NULL;
      IF v_out = 'completed' OR v_out LIKE 'unpaid\_%' THEN
        v_end := v_ts;
        v_start := v_end - make_interval(secs => v_dur_act * 60 + random() * 40);
        v_arr := v_start - make_interval(secs => v_wait * 60);
        v_asg := v_arr - make_interval(secs => v_eta * 60);
        v_req := v_asg - make_interval(secs => v_accept);
      ELSIF v_out IN ('cancel_pax', 'cancel_drv', 'cancel_sys') THEN
        v_end := v_ts;
        v_asg := v_end - make_interval(secs => 60 + random() * 420);
        v_req := v_asg - make_interval(secs => v_accept);
        IF random() < 0.3 THEN v_arr := v_asg + (v_end - v_asg) * 0.7; END IF;
      ELSIF v_out = 'live_inprogress' THEN
        v_start := v_ts;
        v_arr := v_start - make_interval(secs => v_wait * 60);
        v_asg := v_arr - make_interval(secs => v_eta * 60);
        v_req := v_asg - make_interval(secs => v_accept);
      ELSIF v_out = 'live_arrived' THEN
        v_arr := v_ts; v_asg := v_arr - make_interval(secs => v_eta * 60); v_req := v_asg - make_interval(secs => v_accept);
      ELSIF v_out = 'live_assigned' THEN
        v_asg := v_ts; v_req := v_asg - make_interval(secs => v_accept);
      ELSE
        v_req := v_ts;
      END IF;

      v_win_end := CASE WHEN v_out LIKE 'live\_%' THEN v_now + interval '1 hour'
                        ELSE COALESCE(v_end, v_start, v_arr, v_asg, v_req + interval '6 minutes') END;
      IF v_out = 'unpaid_wallet' THEN
        SELECT p.* INTO pax FROM _pax p JOIN _bal bb ON bb.user_id = p.user_id
        WHERE p.city_id = v_city AND p.joined_at < v_req AND NOT p.susp AND p.busy_until <= v_req AND p.k <> 1
          AND NOT EXISTS (SELECT 1 FROM trips t0 WHERE t0.passenger_id = p.user_id AND t0.status <> 'cancelled'
                          AND t0.assigned_at < v_win_end AND COALESCE(t0.completed_at, v_now + interval '1 hour') > v_req)
        ORDER BY bb.bal ASC, random() LIMIT 1;
      ELSE
        SELECT p.* INTO pax FROM _pax p
        WHERE p.city_id = v_city AND p.joined_at < v_req - interval '30 minutes'
          AND (p.active_until IS NULL OR p.active_until > v_req) AND p.busy_until <= v_req
          AND (p.k <> 1 OR (v_out NOT LIKE 'live\_%' AND v_out NOT LIKE 'unpaid\_%'))
          AND NOT EXISTS (SELECT 1 FROM trips t0 WHERE t0.passenger_id = p.user_id AND t0.status <> 'cancelled'
                          AND t0.assigned_at < v_win_end AND COALESCE(t0.completed_at, v_now + interval '1 hour') > v_req)
        ORDER BY -ln(1 - random()) / p.w LIMIT 1;
      END IF;
      IF NOT FOUND THEN CONTINUE; END IF;

      v_have_driver := v_out NOT IN ('expired', 'cancel_pre', 'live_searching', 'live_pending', 'live_scheduled');
      IF v_have_driver THEN
        SELECT d.* INTO drv FROM _drv d
        WHERE d.city_id = v_city AND d.cat_id = v_cat AND d.status IN ('approved', 'suspended')
          AND d.active_from < v_asg AND (d.active_until IS NULL OR d.active_until > v_asg)
          AND d.busy_until <= v_asg - interval '1 minute'
          AND (d.k <> 1 OR (v_out NOT LIKE 'live\_%' AND v_out NOT LIKE 'unpaid\_%'))
          AND NOT EXISTS (SELECT 1 FROM trips t0 WHERE t0.driver_id = d.user_id AND t0.status <> 'cancelled'
                          AND t0.assigned_at < v_win_end AND COALESCE(t0.completed_at, v_now + interval '1 hour') > v_asg - interval '1 minute')
        ORDER BY -ln(1 - random()) / d.w LIMIT 1;
        IF NOT FOUND THEN
          IF v_out IN ('completed', 'cancel_pax', 'cancel_drv', 'cancel_sys') THEN
            v_out := 'expired'; v_have_driver := false; v_arr := NULL; v_start := NULL; v_end := NULL; v_ts := v_req;
          ELSE
            CONTINUE;
          END IF;
        END IF;
      END IF;

      v_zone := fn_zone_at(v_plat, v_plng, v_city);
      v_mult := 1.00;
      IF v_city = v_dhaka AND v_zone IS NOT NULL AND v_hour IN (8, 9, 17, 18, 19)
         AND (v_out = 'completed' OR v_out LIKE 'cancel\_%' OR v_out LIKE 'unpaid\_%') THEN
        v_h := abs(hashtext(v_zone::text || (v_ts AT TIME ZONE 'Asia/Dhaka')::date::text || (v_hour < 12)::text)) % 10;
        v_mult := CASE WHEN v_h = 0 THEN 1.50 WHEN v_h IN (1, 2) THEN 1.20 ELSE 1.00 END;
        IF v_mult > 1 THEN
          INSERT INTO _surged VALUES (v_zone, (v_ts AT TIME ZONE 'Asia/Dhaka')::date, v_hour < 12, v_mult, v_ts);
        END IF;
      END IF;

      SELECT * INTO tf FROM fn_current_pricing(v_city, v_cat, v_req);
      IF NOT FOUND THEN CONTINUE; END IF;
      SELECT * INTO fe FROM cholo_demo_seed.d_fare(tf.base_fare, tf.per_km_rate, tf.per_min_rate, tf.minimum_fare, tf.booking_fee,
                                          tf.waiting_per_min, tf.free_wait_minutes, v_km, v_dur, 0, v_mult);
      SELECT * INTO f FROM cholo_demo_seed.d_fare(tf.base_fare, tf.per_km_rate, tf.per_min_rate, tf.minimum_fare, tf.booking_fee,
                                         tf.waiting_per_min, tf.free_wait_minutes, v_km_act, v_dur_act, round(v_wait), v_mult);

      v_pay := CASE v_out WHEN 'unpaid_bkash' THEN 'bkash' WHEN 'unpaid_wallet' THEN 'wallet' WHEN 'unpaid_card' THEN 'card'
                ELSE CASE WHEN random() < 0.68
                          THEN CASE pax.pref WHEN 'c' THEN 'cash' WHEN 'w' THEN 'wallet' WHEN 'b' THEN 'bkash' WHEN 'n' THEN 'nagad' ELSE 'card' END
                          ELSE (ARRAY['cash', 'cash', 'cash', 'bkash', 'nagad', 'wallet', 'card'])[1 + floor(random() * 7)::int] END END;

      v_pre := f.o_total; v_disc := 0; v_promo_id := NULL;
      IF v_out = 'completed' OR v_out LIKE 'unpaid\_%' THEN
        v_has_done := EXISTS (SELECT 1 FROM trips t WHERE t.passenger_id = pax.user_id AND t.status = 'completed');
        SELECT p.* INTO promo FROM promo_codes p
        WHERE p.valid_from <= v_end AND (p.valid_until IS NULL OR p.valid_until > v_end)
          AND (p.city_id IS NULL OR p.city_id = v_city) AND (p.category_id IS NULL OR p.category_id = v_cat)
          AND (p.min_fare IS NULL OR p.min_fare <= v_pre)
          AND (NOT p.first_ride_only OR NOT v_has_done)
          AND (p.usage_limit_per_user IS NULL OR
               (SELECT count(*) FROM promo_redemptions x WHERE x.promo_code_id = p.id AND x.user_id = pax.user_id) < p.usage_limit_per_user)
          AND (p.usage_limit_total IS NULL OR
               (SELECT count(*) FROM promo_redemptions x WHERE x.promo_code_id = p.id) < p.usage_limit_total)
        ORDER BY p.first_ride_only DESC, random() LIMIT 1;
        IF FOUND AND random() < (CASE WHEN promo.first_ride_only THEN 0.75 ELSE 0.14 END) THEN
          v_promo_id := promo.id;
          v_disc := floor(least(least(CASE WHEN promo.promo_type = 'percentage' THEN v_pre * promo.value / 100 ELSE promo.value END,
                                      COALESCE(promo.max_discount, 1000000)), v_pre));
        END IF;
      END IF;
      v_total := v_pre - v_disc;

      v_rstatus := CASE WHEN v_out IN ('cancel_pax', 'cancel_drv', 'cancel_sys', 'cancel_pre') THEN 'cancelled'
                        WHEN v_out = 'expired' THEN 'expired'
                        WHEN v_out = 'live_searching' THEN 'searching'
                        WHEN v_out IN ('live_pending', 'live_scheduled') THEN 'pending'
                        ELSE 'matched' END;
      INSERT INTO ride_requests
        (passenger_id, city_id, category_id, pickup_lat, pickup_lng, pickup_address, pickup_zone_id,
         dropoff_lat, dropoff_lng, dropoff_address, est_distance_km, est_duration_min, est_fare, surge_multiplier,
         payment_intent, promo_code_id, women_only, scheduled_for, status, requested_at, expires_at, cancelled_at, stops)
      VALUES
        (pax.user_id, v_city, v_cat, v_plat, v_plng, cholo_demo_seed.d_addr(l1.name, l1.area, v_cityname), v_zone,
         v_dlat, v_dlng, cholo_demo_seed.d_addr(l2.name, l2.area, v_cityname), v_km, v_dur::smallint, fe.o_total, v_mult,
         v_pay::payment_channel, v_promo_id, false,
         CASE WHEN v_out = 'live_scheduled' THEN (ev.data->>'at')::timestamptz END,
         v_rstatus, v_req,
         CASE WHEN v_out = 'live_scheduled' THEN NULL ELSE v_req + interval '5 minutes' END,
         CASE WHEN v_rstatus = 'cancelled' THEN COALESCE(v_end, v_req + make_interval(secs => 20 + random() * 130)) END,
         CASE WHEN v_stop THEN jsonb_build_array(jsonb_build_object('lat', v_slat, 'lng', v_slng, 'address', v_saddr)) END)
      RETURNING id INTO v_req_id;

      IF v_have_driver THEN
        INSERT INTO ride_offers (request_id, driver_id, round, driver_distance_km, response, offered_at, responded_at)
        VALUES (v_req_id, drv.user_id, 1, round((0.4 + random() * 3.6)::numeric, 2), 'accepted', v_req + interval '2 seconds', v_asg);
        INSERT INTO ride_offers (request_id, driver_id, round, driver_distance_km, response, offered_at, responded_at)
        SELECT v_req_id, d.user_id, 1, round((0.5 + random() * 4)::numeric, 2),
               (CASE WHEN random() < 0.5 THEN 'rejected' ELSE 'timed_out' END)::offer_response,
               v_req + interval '2 seconds', v_req + interval '17 seconds'
        FROM _drv d
        WHERE d.city_id = v_city AND d.cat_id = v_cat AND d.status = 'approved' AND d.user_id <> drv.user_id
          AND d.active_from < v_req AND (d.active_until IS NULL OR d.active_until > v_req) AND random() < 0.2
        ORDER BY random() LIMIT 2;
      ELSIF v_out IN ('expired', 'cancel_pre', 'live_searching') THEN
        INSERT INTO ride_offers (request_id, driver_id, round, driver_distance_km, response, offered_at, responded_at)
        SELECT v_req_id, d.user_id, 1, round((0.5 + random() * 4)::numeric, 2),
               (CASE v_out WHEN 'expired' THEN 'timed_out' WHEN 'cancel_pre' THEN 'withdrawn' ELSE 'pending' END)::offer_response,
               v_req + interval '2 seconds',
               CASE v_out WHEN 'live_searching' THEN NULL ELSE v_req + interval '20 seconds' END
        FROM _drv d
        WHERE d.city_id = v_city AND d.cat_id = v_cat AND d.status = 'approved'
          AND d.active_from < v_req AND (d.active_until IS NULL OR d.active_until > v_req)
        ORDER BY random() LIMIT (CASE WHEN v_out = 'live_searching' THEN 3 ELSE 2 END);
      END IF;

      IF NOT v_have_driver THEN
        UPDATE _pax SET busy_until = CASE WHEN v_out LIKE 'live\_%' THEN v_now + interval '15 minutes' ELSE v_req + interval '6 minutes' END
        WHERE k = pax.k;
        CONTINUE;
      END IF;

      v_conf := v_start IS NOT NULL AND random() < 0.7;
      v_tstatus := CASE WHEN v_out = 'completed' OR v_out LIKE 'unpaid\_%' THEN 'completed'
                        WHEN v_out = 'live_inprogress' THEN 'in_progress'
                        WHEN v_out = 'live_arrived' THEN 'arrived'
                        WHEN v_out = 'live_assigned' THEN 'assigned'
                        ELSE 'cancelled' END;
      INSERT INTO trips
        (request_id, passenger_id, driver_id, vehicle_id, status, assigned_at, arrived_at, started_at, completed_at,
         actual_distance_km, actual_duration_min, base_fare, distance_fare, time_fare, waiting_fare, surge_amount,
         booking_fee, discount_amount, total_fare, payment_status, created_at, updated_at,
         ended_early_at, end_lat, end_lng, early_stop_requested_at, start_requested_at, pickup_confirmed_at, arrival_disputed_at)
      VALUES
        (v_req_id, pax.user_id, drv.user_id, drv.vehicle_id, v_tstatus, v_asg, v_arr, v_start,
         CASE WHEN v_tstatus = 'completed' THEN v_end END,
         CASE WHEN v_tstatus = 'completed' THEN v_km_act END,
         CASE WHEN v_tstatus = 'completed' THEN v_dur_act::int END,
         CASE WHEN v_tstatus = 'completed' THEN f.o_base ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN f.o_dist ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN f.o_time ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN f.o_wait ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN f.o_surge ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN f.o_booking ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN v_disc ELSE 0 END,
         CASE WHEN v_tstatus = 'completed' THEN v_total ELSE 0 END,
         (CASE WHEN v_out = 'completed' THEN 'paid' ELSE 'unpaid' END)::trip_payment_status,
         v_asg, COALESCE(v_end, v_start, v_arr, v_asg),
         CASE WHEN v_early THEN v_end END, CASE WHEN v_early THEN v_elat END, CASE WHEN v_early THEN v_elng END,
         CASE WHEN v_early THEN v_end - interval '90 seconds' END,
         CASE WHEN v_conf THEN v_start - interval '20 seconds' END,
         CASE WHEN v_conf THEN v_start END,
         CASE WHEN v_out = 'completed' AND random() < 0.015 THEN v_arr - interval '60 seconds' END)
      RETURNING id INTO v_tid;

      v_last := CASE WHEN v_arr IS NOT NULL THEN 'arrived' ELSE 'assigned' END;
      INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, changed_at)
      VALUES (v_tid, NULL, 'assigned', drv.user_id, v_asg);
      IF v_arr IS NOT NULL THEN
        INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, changed_at)
        VALUES (v_tid, 'assigned', 'arrived', drv.user_id, v_arr);
      END IF;
      IF v_start IS NOT NULL THEN
        INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, changed_at)
        VALUES (v_tid, 'arrived', 'in_progress', drv.user_id, v_start);
        v_last := 'in_progress';
      END IF;
      IF v_tstatus = 'completed' THEN
        INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, changed_at)
        VALUES (v_tid, 'in_progress', 'completed', drv.user_id, v_end);
      ELSIF v_tstatus = 'cancelled' THEN
        INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by, note, changed_at)
        VALUES (v_tid, v_last::trip_status, 'cancelled', CASE v_out WHEN 'cancel_pax' THEN pax.user_id WHEN 'cancel_drv' THEN drv.user_id END,
                CASE v_out WHEN 'cancel_sys' THEN 'Cancelled by the system' END, v_end);
        INSERT INTO trip_cancellations (trip_id, cancelled_by_role, cancelled_by, reason_code, reason_text, fee_charged, cancelled_at)
        VALUES (v_tid,
                (CASE v_out WHEN 'cancel_pax' THEN 'passenger' WHEN 'cancel_drv' THEN 'driver' ELSE 'system' END)::cancelled_by_role,
                CASE v_out WHEN 'cancel_pax' THEN pax.user_id WHEN 'cancel_drv' THEN drv.user_id END,
                (CASE v_out
                   WHEN 'cancel_pax' THEN (ARRAY['changed_mind','changed_mind','driver_late','driver_late','wrong_pickup','other'])[1 + floor(random() * 6)::int]
                   WHEN 'cancel_drv' THEN (ARRAY['no_show','no_show','vehicle_issue','wrong_pickup','other'])[1 + floor(random() * 5)::int]
                   ELSE 'other' END)::cancellation_reason_code,
                CASE v_out WHEN 'cancel_pax' THEN (ARRAY['Found another ride', 'Plans changed', 'Driver is taking too long', NULL])[1 + floor(random() * 4)::int]
                           WHEN 'cancel_drv' THEN (ARRAY['Rider not at pickup point', 'Flat tyre', 'Could not find the rider', NULL])[1 + floor(random() * 4)::int]
                           ELSE 'Driver went offline' END,
                0, v_end);
      END IF;

      IF v_stop THEN
        INSERT INTO trip_stops (trip_id, stop_order, lat, lng, address_text, arrived_at)
        VALUES (v_tid, 1, v_slat, v_slng, v_saddr, v_start + (v_end - v_start) * 0.5);
      END IF;

      IF v_tstatus IN ('completed', 'in_progress', 'arrived') AND v_arr IS NOT NULL AND random() < 0.12 THEN
        INSERT INTO trip_messages (trip_id, sender_id, message_type, body, sent_at, read_at) VALUES
          (v_tid, pax.user_id, 'quick_reply', q_pax[1 + floor(random() * 4)::int], v_asg + interval '25 seconds', v_asg + interval '40 seconds'),
          (v_tid, drv.user_id, 'quick_reply', q_drv[1 + floor(random() * 4)::int], v_asg + (v_arr - v_asg) * 0.6, v_asg + (v_arr - v_asg) * 0.6 + interval '10 seconds'),
          (v_tid, pax.user_id, 'text', 'Okay, thank you', v_arr + interval '15 seconds', v_arr + interval '30 seconds');
      END IF;

      IF v_tstatus = 'completed' THEN
        INSERT INTO receipts (trip_id, issued_to, subtotal, discount, total, issued_at)
        VALUES (v_tid, pax.user_id, v_pre, v_disc, v_total, v_end);
        IF v_promo_id IS NOT NULL THEN
          INSERT INTO promo_redemptions (promo_code_id, user_id, trip_id, discount_amount, redeemed_at)
          VALUES (v_promo_id, pax.user_id, v_tid, v_disc, v_end);
        END IF;
        IF v_early THEN
          INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, created_at)
          VALUES (drv.user_id, 'DRIVER', 'TRIP_ENDED_EARLY', 'trips', v_tid,
                  jsonb_build_object('plannedDropoff', jsonb_build_object('lat', v_dlat, 'lng', v_dlng)),
                  jsonb_build_object('endedAt', jsonb_build_object('lat', v_elat, 'lng', v_elng), 'distanceKm', v_km_act, 'totalFare', v_total), v_end);
          INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
          VALUES (pax.user_id, 'ride', 'Your trip ended before the planned drop-off',
                  'You asked to stop, so your driver ended the trip there. You were charged for the ' || v_km_act || ' km driven.',
                  jsonb_build_object('tripId', v_tid), v_end, v_end + interval '20 minutes');
        END IF;
      END IF;

      IF v_out = 'completed' THEN
        SELECT * INTO cm FROM fn_current_commission(v_cat, v_city, v_end);
        v_gross := v_pre; v_comm := round(v_gross * cm.commission_pct / 100, 2); v_net := v_gross - v_comm;
        v_pay_at := v_end;
        IF v_pay = 'wallet' THEN
          PERFORM cholo_demo_seed.d_fund(pax.user_id, v_total, v_req - make_interval(mins => 1 + floor(random() * 8)::int));
        END IF;
        IF v_pay IN ('cash', 'wallet') THEN
          INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, initiated_at, completed_at)
          VALUES ('trip', v_tid, pax.user_id, v_pay::payment_channel, 'none', v_total, 'succeeded', v_end, v_end)
          RETURNING id INTO v_pay_id;
          IF v_pay = 'wallet' THEN
            PERFORM cholo_demo_seed.d_txn(pax.user_id, v_end, 'trip_payment', 'debit', v_total, 'trip', v_tid, 'trip-payment-' || v_tid, NULL);
          END IF;
        ELSE
          v_pay_at := v_end + make_interval(secs => 40 + random() * 100);
          IF random() < 0.07 THEN
            INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, failure_reason, initiated_at, completed_at)
            VALUES ('trip', v_tid, pax.user_id, v_pay::payment_channel, 'sslcommerz', v_total, 'failed',
                    f_reasons[1 + floor(random() * 4)::int], v_end + interval '10 seconds', v_end + interval '35 seconds');
            v_pay_at := v_end + make_interval(secs => 110 + random() * 60);
          END IF;
          INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, gateway_txn_id, amount, status, initiated_at, completed_at)
          VALUES ('trip', v_tid, pax.user_id, v_pay::payment_channel, 'sslcommerz',
                  'SSL' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 14)), v_total, 'succeeded',
                  v_pay_at - interval '45 seconds', v_pay_at)
          RETURNING id INTO v_pay_id;
        END IF;

        INSERT INTO driver_earnings (trip_id, driver_id, gross_fare, commission_rule_id, commission_pct, commission_amount, net_earning, earned_at)
        VALUES (v_tid, drv.user_id, v_gross, cm.id, cm.commission_pct, v_comm, v_net, v_pay_at);
        IF v_pay = 'cash' THEN
          v_delta := v_disc - v_comm;
          IF v_delta > 0 THEN
            PERFORM cholo_demo_seed.d_txn(drv.user_id, v_pay_at, 'trip_earning', 'credit', v_delta, 'trip', v_tid, 'earning-trip-' || v_tid,
                                  'Promo discount paid by Cholo, less commission');
          ELSIF v_delta < 0 THEN
            PERFORM cholo_demo_seed.d_fund(drv.user_id, -v_delta, v_pay_at - interval '30 seconds');
            PERFORM cholo_demo_seed.d_txn(drv.user_id, v_pay_at, 'commission', 'debit', -v_delta, 'trip', v_tid, 'commission-trip-' || v_tid, NULL);
          END IF;
        ELSE
          PERFORM cholo_demo_seed.d_txn(drv.user_id, v_pay_at, 'trip_earning', 'credit', v_net, 'trip', v_tid, 'earning-trip-' || v_tid, NULL);
        END IF;

        SELECT id INTO rf FROM referrals WHERE referee_id = pax.user_id AND status = 'pending';
        IF FOUND THEN
          PERFORM cholo_demo_seed.d_txn((SELECT referrer_id FROM referrals WHERE id = rf.id), v_end, 'referral_bonus', 'credit', 50, 'referral', rf.id,
                                'referral-' || rf.id || '-referrer', 'A friend you invited took their first ride');
          PERFORM cholo_demo_seed.d_txn(pax.user_id, v_end, 'referral_bonus', 'credit', 50, 'referral', rf.id,
                                'referral-' || rf.id || '-referee', 'Welcome bonus for joining with a referral code');
          UPDATE referrals SET status = 'rewarded', qualifying_trip_id = v_tid, referrer_bonus = 50, referee_bonus = 50, rewarded_at = v_end
          WHERE id = rf.id;
          INSERT INTO notifications (user_id, category, title, body, created_at, read_at)
          VALUES (pax.user_id, 'promo', '50 BDT referral bonus added to your wallet', 'Thanks for joining Cholo with a friend''s code.', v_end, v_end + interval '1 hour'),
                 ((SELECT referrer_id FROM referrals WHERE id = rf.id), 'promo', '50 BDT referral bonus added to your wallet', 'Your friend finished their first Cholo ride.', v_end, v_end + interval '5 hours');
        END IF;

        IF random() < 0.86 THEN
          r := random();
          v_score := CASE WHEN r < 0.70 THEN 5 WHEN r < 0.90 THEN 4 WHEN r < 0.955 THEN 3 WHEN r < 0.985 THEN 2 ELSE 1 END;
          INSERT INTO ratings (trip_id, rater_id, ratee_id, rater_role, score, comment, tags, created_at)
          VALUES (v_tid, pax.user_id, drv.user_id, 'passenger', v_score,
                  CASE WHEN v_score >= 4 AND random() < 0.4 THEN c_pos[1 + floor(random() * 10)::int]
                       WHEN v_score = 3 AND random() < 0.7 THEN c_mid[1 + floor(random() * 4)::int]
                       WHEN v_score <= 2 AND random() < 0.8 THEN c_low[1 + floor(random() * 5)::int] END,
                  CASE WHEN v_score >= 4 AND random() < 0.5 THEN to_jsonb(ARRAY[t_pos[1 + floor(random() * 5)::int], t_pos[1 + floor(random() * 5)::int]])
                       WHEN v_score <= 3 AND random() < 0.6 THEN to_jsonb(ARRAY[t_neg[1 + floor(random() * 4)::int]]) END,
                  v_end + make_interval(mins => 1 + floor(random() * 90)::int));
        END IF;
        IF random() < 0.35 THEN
          r := random();
          INSERT INTO ratings (trip_id, rater_id, ratee_id, rater_role, score, comment, created_at)
          VALUES (v_tid, drv.user_id, pax.user_id, 'driver', CASE WHEN r < 0.8 THEN 5 WHEN r < 0.95 THEN 4 ELSE 3 END,
                  CASE WHEN random() < 0.3 THEN c_pax[1 + floor(random() * 4)::int] END,
                  v_end + make_interval(mins => 2 + floor(random() * 120)::int));
        END IF;

        IF random() < (CASE WHEN v_end > v_now - interval '4 days' THEN 0.15 ELSE 0.035 END) AND v_end < v_now - interval '1 hour' THEN
          r := random();
          v_dtype := CASE WHEN r < 0.40 THEN 'fare_overcharge' WHEN r < 0.60 THEN 'service_quality' WHEN r < 0.72 THEN 'behavior'
                          WHEN r < 0.85 THEN 'lost_item' ELSE 'payment_failed' END;
          v_dby := CASE WHEN random() < 0.85 THEN pax.user_id ELSE drv.user_id END;
          IF v_dby = drv.user_id THEN v_dtype := CASE WHEN random() < 0.6 THEN 'behavior' ELSE 'lost_item' END; END IF;
          v_dcreated := least(v_end + make_interval(mins => 20 + floor(random() * 400)::int), v_now - interval '1 minute');
          v_damt := CASE WHEN v_dtype = 'fare_overcharge' THEN greatest(10, floor(v_total * (0.1 + random() * 0.3) / 10) * 10) END;
          v_ddesc := CASE v_dtype
              WHEN 'fare_overcharge' THEN (ARRAY['The fare was higher than the estimate shown in the app.', 'I was charged for a longer route than we actually took.'])[1 + floor(random() * 2)::int]
              WHEN 'service_quality' THEN 'The vehicle was not clean and the AC did not work.'
              WHEN 'behavior' THEN 'The other person was rude and unprofessional during the trip.'
              WHEN 'lost_item' THEN 'I left my bag on the back seat after the trip.'
              ELSE 'My payment was deducted but the trip still shows as unpaid.' END;
          r := random();
          IF v_dcreated > v_now - interval '18 hours' THEN v_dstatus := 'open';
          ELSIF v_dcreated > v_now - interval '3 days' THEN v_dstatus := CASE WHEN r < 0.5 THEN 'open' ELSE 'under_review' END;
          ELSE v_dstatus := CASE WHEN r < 0.40 AND v_pay <> 'cash' AND v_dby = pax.user_id THEN 'resolved_refunded'
                                 WHEN r < 0.75 THEN 'resolved_no_action' ELSE 'rejected' END;
          END IF;
          v_dres := CASE WHEN v_dstatus IN ('resolved_refunded', 'resolved_no_action', 'rejected')
                         THEN least(v_dcreated + make_interval(hours => 20 + floor(random() * 60)::int), v_now - interval '1 minute') END;
          v_dref := CASE WHEN v_dstatus = 'resolved_refunded' THEN least(COALESCE(v_damt, round(v_total / 2)), v_total) END;
          v_dnote := CASE v_dstatus
              WHEN 'resolved_refunded' THEN 'Reviewed the route and fare. ' || v_dref || ' BDT refunded to the rider wallet.'
              WHEN 'resolved_no_action' THEN 'The fare matches the recorded route and waiting time. No change needed.'
              WHEN 'rejected' THEN 'We could not find enough evidence to support this claim.' END;
          INSERT INTO disputes (trip_id, raised_by, dispute_type, description, disputed_amount, status, resolution_note,
                                resolved_by, refund_payment_id, created_at, resolved_at, review_started_at)
          VALUES (v_tid, v_dby, v_dtype::dispute_type, v_ddesc, v_damt, v_dstatus::dispute_status, v_dnote,
                  CASE WHEN v_dstatus = 'resolved_refunded' THEN v_fin WHEN v_dres IS NOT NULL THEN v_sup END,
                  CASE WHEN v_dstatus = 'resolved_refunded' THEN v_pay_id END, v_dcreated, v_dres,
                  CASE WHEN v_dstatus <> 'open' THEN least(v_dcreated + make_interval(hours => 2 + floor(random() * 16)::int), COALESCE(v_dres, v_now)) END)
          RETURNING id, dispute_no INTO v_did, v_dno;
          IF v_dstatus = 'resolved_refunded' THEN
            INSERT INTO _ev (ts, kind, data)
            VALUES (v_dres, 'refund', jsonb_build_object('dispute', v_did, 'dispute_no', v_dno, 'payment', v_pay_id, 'trip', v_tid,
                    'pax', pax.user_id, 'driver', drv.user_id, 'amount', v_dref, 'gross', v_gross, 'net', v_net));
          END IF;
        END IF;

      ELSIF v_out LIKE 'unpaid\_%' THEN
        IF v_out = 'unpaid_bkash' THEN
          INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, initiated_at)
          VALUES ('trip', v_tid, pax.user_id, 'bkash', 'sslcommerz', v_total, 'initiated', v_end + interval '60 seconds');
        ELSIF v_out = 'unpaid_card' THEN
          INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, failure_reason, initiated_at, completed_at)
          VALUES ('trip', v_tid, pax.user_id, 'card', 'sslcommerz', v_total, 'failed', 'Card declined by issuer',
                  v_end + interval '30 seconds', v_end + interval '75 seconds');
        ELSE
          INSERT INTO notifications (user_id, category, title, body, payload, created_at)
          VALUES (pax.user_id, 'payment', 'Payment due for your trip',
                  'Your wallet did not cover the ' || v_total || ' BDT fare. Pay with bKash, Nagad, card or a top-up to keep riding.',
                  jsonb_build_object('tripId', v_tid), v_end);
        END IF;
      END IF;

      IF v_out = 'live_inprogress' THEN
        INSERT INTO trip_location_pings (trip_id, lat, lng, speed_kmh, heading, recorded_at)
        SELECT v_tid, round(v_plat + (v_dlat - v_plat) * least(0.95, g / 5.0 * (extract(epoch FROM (v_now - v_start)) / 60.0 / v_dur)), 6),
               round(v_plng + (v_dlng - v_plng) * least(0.95, g / 5.0 * (extract(epoch FROM (v_now - v_start)) / 60.0 / v_dur)), 6),
               round((14 + random() * 22)::numeric, 2), round((degrees(atan2(v_dlng - v_plng, v_dlat - v_plat)) + 360)::numeric % 360, 2),
               v_start + (v_now - v_start) * g / 5.0
        FROM generate_series(0, 5) g;
      END IF;

      IF v_out = 'completed' AND v_end > v_now - interval '3 days' AND random() < 0.15 THEN
        INSERT INTO trip_location_pings (trip_id, lat, lng, speed_kmh, heading, recorded_at)
        SELECT v_tid, round(v_plat + (v_dlat - v_plat) * (g / 4.0), 6), round(v_plng + (v_dlng - v_plng) * (g / 4.0), 6),
               round((12 + random() * 25)::numeric, 2), round((degrees(atan2(v_dlng - v_plng, v_dlat - v_plat)) + 360)::numeric % 360, 2),
               v_start + (v_end - v_start) * (g / 4.0)
        FROM generate_series(0, 4) g;
      END IF;

      UPDATE _pax SET busy_until = CASE WHEN v_out LIKE 'live\_%' THEN v_now + interval '2 hours' ELSE greatest(busy_until, COALESCE(v_end, v_req + interval '10 minutes')) END
      WHERE k = pax.k;
      UPDATE _drv SET busy_until = CASE WHEN v_out LIKE 'live\_%' THEN v_now + interval '2 hours' ELSE greatest(busy_until, COALESCE(v_end, v_asg + interval '10 minutes')) END
      WHERE k = drv.k;
    END LOOP;

    ALTER TABLE trips ENABLE TRIGGER trg_log_trip_status_insert;
    ALTER TABLE trips ENABLE TRIGGER trg_log_trip_status_update;
  END;

  -- Surge windows derived from the surged trips, plus a few extras
  INSERT INTO surge_pricing (zone_id, category_id, multiplier, reason, starts_at, ends_at, is_active, created_by, created_at)
  SELECT s.zone_id, NULL, s.mult, 'peak_hour', min(s.ts) - interval '30 minutes', max(s.ts) + interval '30 minutes',
         max(s.ts) + interval '30 minutes' > v_now, v_super, min(s.ts) - interval '35 minutes'
  FROM _surged s GROUP BY s.zone_id, s.day, s.morning, s.mult;

  INSERT INTO surge_pricing (zone_id, category_id, multiplier, reason, starts_at, ends_at, is_active, created_by, created_at)
  SELECT z.id, x.cat, x.mult, x.reason::surge_reason, v_now - x.starts, v_now - x.starts + x.len, x.active, v_super, v_now - x.starts - interval '5 minutes'
  FROM (VALUES
    ('Gulshan-Banani',            NULL::smallint, 1.30, 'demand',  interval '40 minutes', interval '2 hours',  true),
    ('Hazrat Shahjalal Airport',  c_car,          1.40, 'event',   interval '30 hours',   interval '3 hours',  false),
    ('Dhanmondi-Lalmatia',        NULL::smallint, 1.50, 'weather', interval '8 days',     interval '4 hours',  false)
  ) AS x(zone, cat, mult, reason, starts, len, active)
  JOIN zones z ON z.name = x.zone AND z.city_id = v_dhaka;

  INSERT INTO favorite_drivers (passenger_id, driver_id, created_at)
  SELECT t.passenger_id, t.driver_id, max(t.completed_at) - interval '1 hour'
  FROM trips t WHERE t.status = 'completed'
  GROUP BY t.passenger_id, t.driver_id HAVING count(*) >= 3
  ORDER BY random() LIMIT 25
  ON CONFLICT DO NOTHING;

  -- Weekly driver invoices and settlement
  WITH w AS (
    SELECT de.driver_id, date_trunc('week', de.earned_at AT TIME ZONE 'Asia/Dhaka')::date AS ps,
           count(*)::int AS n, sum(de.gross_fare) AS g, sum(de.commission_amount) AS c, sum(de.net_earning) AS nn
    FROM driver_earnings de WHERE de.invoice_id IS NULL GROUP BY 1, 2
  )
  INSERT INTO invoices (invoice_no, driver_id, period_start, period_end, trips_count, total_gross, total_commission,
                        total_net, status, generated_at)
  SELECT 'INV-' || to_char(w.ps + 6, 'IYYY') || '-W' || to_char(w.ps + 6, 'IW') || '-D' || lpad(nextval('seq_invoice_no')::text, 4, '0'),
         w.driver_id, w.ps, w.ps + 6, w.n, w.g, w.c, w.nn,
         (CASE WHEN w.ps + 6 < v_today - 21 THEN 'paid' ELSE 'finalized' END)::invoice_status,
         ((w.ps + 7)::timestamp + interval '9 hours') AT TIME ZONE 'Asia/Dhaka'
  FROM w WHERE w.ps + 6 < v_today - 7
  ORDER BY w.ps, w.driver_id;

  UPDATE driver_earnings de
  SET invoice_id = i.id,
      settlement_status = (CASE WHEN i.status = 'paid' THEN 'settled' ELSE 'pending' END)::settlement_status,
      settled_at = CASE WHEN i.status = 'paid' THEN ((i.period_end + 2)::timestamp + interval '11 hours') AT TIME ZONE 'Asia/Dhaka' END
  FROM invoices i
  WHERE de.invoice_id IS NULL AND i.driver_id = de.driver_id
    AND (de.earned_at AT TIME ZONE 'Asia/Dhaka')::date BETWEEN i.period_start AND i.period_end;

  UPDATE driver_earnings SET settlement_status = 'withheld'
  WHERE id IN (SELECT e.id FROM driver_earnings e WHERE e.driver_id = (SELECT user_id FROM _drv WHERE k = 19)
                 AND e.settlement_status = 'pending' ORDER BY e.earned_at DESC LIMIT 6);

  -- Profile counters
  UPDATE driver_profiles dp SET total_trips = c.n
  FROM (SELECT driver_id, count(*)::int AS n FROM trips WHERE status = 'completed' GROUP BY 1) c WHERE dp.user_id = c.driver_id;
  UPDATE passenger_profiles pp SET total_trips = c.n
  FROM (SELECT passenger_id, count(*)::int AS n FROM trips WHERE status = 'completed' GROUP BY 1) c WHERE pp.user_id = c.passenger_id;
  UPDATE driver_profiles p SET rating_avg = s.avg, rating_count = s.n
  FROM (SELECT ratee_id, round(avg(score)::numeric, 2) AS avg, count(*)::int AS n FROM ratings WHERE rater_role = 'passenger' GROUP BY 1) s
  WHERE p.user_id = s.ratee_id;
  UPDATE passenger_profiles p SET rating_avg = s.avg, rating_count = s.n
  FROM (SELECT ratee_id, round(avg(score)::numeric, 2) AS avg, count(*)::int AS n FROM ratings WHERE rater_role = 'driver' GROUP BY 1) s
  WHERE p.user_id = s.ratee_id;
  UPDATE driver_profiles p SET acceptance_rate = s.rate
  FROM (SELECT driver_id, round(100.0 * count(*) FILTER (WHERE response = 'accepted') / count(*), 2) AS rate
        FROM ride_offers GROUP BY 1) s WHERE p.user_id = s.driver_id;
  UPDATE driver_profiles p SET cancellation_rate = s.rate
  FROM (SELECT t.driver_id, round(100.0 * count(*) FILTER (WHERE tc.cancelled_by_role = 'driver') / count(*), 2) AS rate
        FROM trips t LEFT JOIN trip_cancellations tc ON tc.trip_id = t.id GROUP BY 1) s WHERE p.user_id = s.driver_id;

  -- Live driver availability
  UPDATE driver_availability da
  SET status = st.state::driver_availability_status,
      current_lat = round(l.lat + (random()::numeric - 0.5) * 0.006, 6),
      current_lng = round(l.lng + (random()::numeric - 0.5) * 0.006, 6),
      heading = round((random() * 360)::numeric, 2),
      last_ping_at = CASE st.state
        WHEN 'online'  THEN v_now - random() * interval '60 seconds'
        WHEN 'on_trip' THEN v_now - random() * interval '10 seconds'
        WHEN 'break'   THEN v_now - (5 + random() * 20) * interval '1 minute'
        ELSE v_now - (1 + random() * 29) * interval '1 hour' END
  FROM (
    SELECT d.user_id, d.city_id,
           CASE WHEN EXISTS (SELECT 1 FROM trips t WHERE t.driver_id = d.user_id AND t.status IN ('assigned', 'arrived', 'in_progress')) THEN 'on_trip'
                WHEN d.k = 1 THEN 'offline'
                WHEN d.status <> 'approved' OR d.active_until IS NOT NULL THEN 'offline'
                WHEN d.r < 0.55 THEN 'online' WHEN d.r < 0.63 THEN 'break' ELSE 'offline' END AS state
    FROM (SELECT d0.*, random() AS r FROM _drv d0) d
  ) st
  CROSS JOIN LATERAL (SELECT x.lat, x.lng FROM _loc x WHERE x.city_id = st.city_id ORDER BY random() LIMIT 1) l
  WHERE da.driver_id = st.user_id;
  UPDATE driver_availability SET current_lat = 23.746100, current_lng = 90.374200, heading = 35, last_ping_at = v_now - interval '20 minutes'
  WHERE driver_id = (SELECT user_id FROM _drv WHERE k = 1);
  UPDATE driver_availability da
  SET current_zone_id = fn_zone_at(da.current_lat, da.current_lng, (SELECT d.city_id FROM _drv d WHERE d.user_id = da.driver_id))
  WHERE da.driver_id IN (SELECT user_id FROM _drv) AND da.current_lat IS NOT NULL;

  -- Support tickets
  CREATE TEMP TABLE _tk AS
  SELECT * FROM (VALUES
    (1,  'pax', 'payment',        'Charged twice for one trip', 'I paid 250 BDT through bKash and the amount was deducted twice. Please refund the extra payment.', 'high'),
    (2,  'pax', 'payment',        'Promo code was not applied', 'I entered a valid promo code before booking but the discount did not appear on my fare.', 'medium'),
    (3,  'pax', 'payment',        'Wallet top-up is missing', 'I topped up 1000 BDT with Nagad an hour ago and the money is not in my wallet.', 'high'),
    (4,  'pax', 'ride',           'Driver took a much longer route', 'The driver ignored the map and took a longer road, so my fare was higher than expected.', 'medium'),
    (5,  'pax', 'ride',           'I left my phone in the car', 'I think I left my phone on the back seat of my last ride. Can you connect me with the driver?', 'high'),
    (6,  'pax', 'ride',           'Driver never arrived at pickup', 'The driver marked arrival but I never saw the vehicle. I waited 15 minutes.', 'medium'),
    (7,  'pax', 'account',        'Cannot log in with my phone number', 'The app says my password is wrong even after I reset it.', 'medium'),
    (8,  'pax', 'account',        'Please change my registered phone number', 'I have a new SIM and want to move my account to the new number.', 'low'),
    (9,  'pax', 'driver_conduct', 'Driver was rude during the trip', 'The driver shouted at me when I asked him to turn on the AC.', 'urgent'),
    (10, 'pax', 'driver_conduct', 'Driver asked for extra cash', 'After the trip the driver demanded extra money on top of the app fare.', 'high'),
    (11, 'pax', 'app_issue',      'App crashes when I open the map', 'Every time I open the booking screen the app closes on my Redmi phone.', 'medium'),
    (12, 'pax', 'app_issue',      'Live tracking is stuck', 'The driver marker did not move for five minutes during my trip.', 'medium'),
    (13, 'pax', 'app_issue',      'বাংলা লেখা ঠিকমতো দেখা যাচ্ছে না', 'অ্যাপে কিছু বাংলা লেখা ভাঙা দেখাচ্ছে, দয়া করে ঠিক করুন।', 'low'),
    (14, 'pax', 'other',          'Feedback on the fare estimate', 'The estimate is often lower than the final fare during peak hours. Could you show a range?', 'low'),
    (15, 'drv', 'payment',        'Commission looks wrong on my last trip', 'The commission deducted from my wallet is higher than 15 percent on one trip.', 'high'),
    (16, 'drv', 'payment',        'Withdrawal is taking too long', 'I requested a withdrawal two days ago and it is still pending.', 'high'),
    (17, 'drv', 'account',        'My document was rejected, need help', 'My licence photo was rejected but the image is clear. Please review again.', 'medium'),
    (18, 'drv', 'ride',           'Rider did not pay the fare', 'The rider left without paying and the trip shows unpaid.', 'high'),
    (19, 'drv', 'app_issue',      'Not receiving ride requests', 'I have been online for an hour in Mirpur and got no requests.', 'medium'),
    (20, 'drv', 'other',          'How can I register a second vehicle?', 'I bought a new car and want to add it to my profile.', 'low')
  ) AS t(i, who, category, subject, descr, priority);

  DECLARE
    n int; tk record; u bigint; created timestamptz; r numeric; st text; trip_ref bigint; tid bigint;
    resolved timestamptz; closed timestamptz; assignee bigint; ticket_no text;
  BEGIN
    FOR n IN 1..40 LOOP
      SELECT * INTO tk FROM _tk WHERE i = 1 + (n - 1) % 20;
      IF tk.who = 'pax' THEN
        SELECT user_id INTO u FROM _pax WHERE NOT susp AND joined_at < v_now - interval '5 days' ORDER BY random() LIMIT 1;
      ELSE
        SELECT user_id INTO u FROM _drv WHERE status = 'approved' AND active_until IS NULL ORDER BY random() LIMIT 1;
      END IF;
      created := v_now - ((41 - n) * 0.78 + random()) * interval '1 day' - random() * interval '8 hours';
      r := random();
      st := CASE
        WHEN created < v_now - interval '21 days' THEN CASE WHEN r < 0.55 THEN 'closed' ELSE 'resolved' END
        WHEN created < v_now - interval '10 days' THEN CASE WHEN r < 0.15 THEN 'closed' WHEN r < 0.70 THEN 'resolved' WHEN r < 0.85 THEN 'in_progress' WHEN r < 0.95 THEN 'waiting_user' ELSE 'open' END
        ELSE CASE WHEN r < 0.40 THEN 'open' WHEN r < 0.65 THEN 'in_progress' WHEN r < 0.80 THEN 'waiting_user' ELSE 'resolved' END END;
      trip_ref := NULL;
      IF tk.category IN ('ride', 'payment', 'driver_conduct') THEN
        SELECT t.id INTO trip_ref FROM trips t
        WHERE (t.passenger_id = u OR t.driver_id = u) AND t.status = 'completed' AND t.completed_at < created
        ORDER BY random() LIMIT 1;
      END IF;
      assignee := CASE WHEN st = 'open' THEN NULL WHEN n % 4 = 0 THEN v_super ELSE v_sup END;
      resolved := CASE WHEN st IN ('resolved', 'closed') THEN least(created + make_interval(hours => 6 + floor(random() * 60)::int), v_now - interval '10 minutes') END;
      closed := CASE WHEN st = 'closed' THEN least(resolved + make_interval(days => 1 + floor(random() * 2)::int), v_now - interval '5 minutes') END;
      INSERT INTO support_tickets (user_id, trip_id, category, subject, description, status, priority, assigned_to, created_at, resolved_at, closed_at)
      VALUES (u, trip_ref, tk.category::ticket_category, tk.subject, tk.descr, st::ticket_status, tk.priority::ticket_priority,
              assignee, created, resolved, closed)
      RETURNING id, support_tickets.ticket_no INTO tid, ticket_no;
      INSERT INTO support_ticket_messages (ticket_id, sender_id, body, sent_at) VALUES (tid, u, tk.descr, created);
      IF st <> 'open' THEN
        INSERT INTO support_ticket_messages (ticket_id, sender_id, body, sent_at) VALUES
          (tid, assignee, CASE WHEN st = 'waiting_user'
             THEN 'Thanks for reaching out. Could you share a screenshot or the exact time this happened so we can check?'
             ELSE 'Hi, thanks for contacting Cholo support. We are looking into this now and will update you shortly.' END,
           created + make_interval(mins => 30 + floor(random() * 240)::int));
        IF st IN ('in_progress', 'resolved', 'closed') THEN
          INSERT INTO support_ticket_messages (ticket_id, sender_id, body, is_internal_note, sent_at)
          VALUES (tid, assignee, 'Checked the trip log and payment records. Waiting for the finance team to confirm.', true,
                  created + make_interval(hours => 2 + floor(random() * 5)::int));
        END IF;
        IF st IN ('resolved', 'closed') THEN
          INSERT INTO support_ticket_messages (ticket_id, sender_id, body, sent_at) VALUES
            (tid, u, 'Thank you for the quick help.', resolved - interval '40 minutes'),
            (tid, assignee, 'This has been fixed on our side. Please let us know if anything else comes up.', resolved - interval '10 minutes');
        END IF;
        INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, created_at)
        VALUES (assignee, 'ADMIN', 'SUPPORT_TICKET_UPDATED', 'support_tickets', tid,
                jsonb_build_object('status', 'open'), jsonb_build_object('status', st), created + interval '40 minutes');
        INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
        VALUES (u, 'system', 'Support replied to ticket ' || ticket_no, 'Open the ticket to read the reply.',
                jsonb_build_object('ticketId', tid), created + interval '45 minutes',
                CASE WHEN random() < 0.7 THEN created + interval '3 hours' END);
      END IF;
    END LOOP;
  END;

  -- User reports
  INSERT INTO user_reports (reporter_id, reported_id, trip_id, category, description, status, handled_by, created_at, resolved_at)
  SELECT CASE WHEN x.by_pax THEN t.passenger_id ELSE t.driver_id END,
         CASE WHEN x.by_pax THEN t.driver_id ELSE t.passenger_id END,
         t.id, x.category::report_category, x.descr, x.status::report_status,
         CASE WHEN x.status = 'open' THEN NULL ELSE v_sup END,
         t.completed_at + interval '3 hours',
         CASE WHEN x.status IN ('action_taken', 'dismissed') THEN t.completed_at + interval '2 days' END
  FROM (VALUES
    (1,  true,  'behavior',   'Driver was shouting at other drivers and drove aggressively.',        'open'),
    (2,  true,  'safety',     'Driver was speeding and ignored the red light near Farmgate.',        'open'),
    (3,  false, 'behavior',   'Rider was abusive and refused to wear a helmet.',                     'open'),
    (4,  true,  'harassment', 'Driver made uncomfortable comments during the ride.',                 'open'),
    (5,  true,  'fraud',      'Driver asked me to cancel and pay him in cash outside the app.',      'investigating'),
    (6,  true,  'safety',     'Vehicle had no working seat belts.',                                  'investigating'),
    (7,  true,  'behavior',   'Driver refused to use the AC and was rude about it.',                 'action_taken'),
    (8,  false, 'fraud',      'Rider used a fake promo screenshot to get a discount.',               'action_taken'),
    (9,  true,  'other',      'Driver was late by 20 minutes but the ETA was wrong, not his fault.', 'dismissed'),
    (10, false, 'behavior',   'Rider kept the driver waiting for ten minutes at the pickup point.',  'dismissed')
  ) AS x(n, by_pax, category, descr, status)
  CROSS JOIN LATERAL (
    SELECT t0.* FROM trips t0 WHERE t0.status = 'completed' AND t0.completed_at < v_now - interval '3 days'
      AND t0.completed_at > v_now - interval '30 days' AND x.n > 0
    ORDER BY random() LIMIT 1) t;

  INSERT INTO user_reports (reporter_id, reported_id, trip_id, category, description, status, handled_by, created_at, resolved_at)
  SELECT t.driver_id, t.passenger_id, t.id, 'behavior', 'The rider did not show up and was abusive on the phone.', 'action_taken', v_sup,
         t.completed_at + interval '2 hours', t.completed_at + interval '1 day'
  FROM trips t WHERE t.passenger_id = (SELECT user_id FROM _pax WHERE k = 14) AND t.status = 'completed'
  ORDER BY t.completed_at DESC LIMIT 1;
  INSERT INTO user_reports (reporter_id, reported_id, trip_id, category, description, status, handled_by, created_at, resolved_at)
  SELECT t.passenger_id, t.driver_id, t.id, 'behavior', 'Driver was rude and refused to follow the route.', 'action_taken', v_sup,
         t.completed_at + interval '2 hours', t.completed_at + interval '1 day'
  FROM trips t WHERE t.driver_id = (SELECT user_id FROM _drv WHERE k = 19) AND t.status = 'completed'
  ORDER BY t.completed_at DESC LIMIT 2;

  -- SOS alerts
  INSERT INTO sos_alerts (trip_id, triggered_by, lat, lng, status, acknowledged_by, triggered_at, resolved_at, resolution_note)
  SELECT t.id, t.passenger_id, round((rr.pickup_lat + rr.dropoff_lat) / 2, 6), round((rr.pickup_lng + rr.dropoff_lng) / 2, 6),
         'active', NULL, v_now - interval '3 minutes', NULL, NULL
  FROM trips t JOIN ride_requests rr ON rr.id = t.request_id
  WHERE t.status = 'in_progress' ORDER BY t.started_at LIMIT 1;

  INSERT INTO sos_alerts (trip_id, triggered_by, lat, lng, status, acknowledged_by, triggered_at, resolved_at, resolution_note)
  SELECT x.trip_id, x.uid, x.lat, x.lng, x.status::sos_status, CASE WHEN x.status = 'active' THEN NULL ELSE v_sup END,
         x.at, CASE WHEN x.status IN ('resolved', 'false_alarm') THEN x.at + interval '35 minutes' END,
         CASE x.status WHEN 'resolved' THEN 'Rider confirmed she is safe. Support spoke with the driver and logged the incident.'
                       WHEN 'false_alarm' THEN 'Triggered by accident, rider confirmed by phone.' END
  FROM (
    SELECT t.id AS trip_id, t.passenger_id AS uid, round((rr.pickup_lat + rr.dropoff_lat) / 2, 6) AS lat,
           round((rr.pickup_lng + rr.dropoff_lng) / 2, 6) AS lng, t.started_at + interval '6 minutes' AS at,
           (ARRAY['acknowledged', 'resolved', 'resolved', 'resolved', 'false_alarm', 'false_alarm'])[row_number() OVER (ORDER BY t.completed_at DESC)] AS status
    FROM (SELECT * FROM trips WHERE status = 'completed' AND completed_at < v_now - interval '2 hours'
                 AND completed_at > v_now - interval '40 days' ORDER BY random() LIMIT 6) t
    JOIN ride_requests rr ON rr.id = t.request_id
  ) x;
  UPDATE sos_alerts SET triggered_at = v_now - interval '95 minutes', resolved_at = NULL
  WHERE status = 'acknowledged';

  -- Notifications
  INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
  SELECT t.passenger_id, 'ride', 'Trip completed',
         'Your ride ' || t.trip_code || ' has ended. Total fare: ' || t.total_fare::int || ' BDT.',
         jsonb_build_object('tripCode', t.trip_code), t.completed_at,
         CASE WHEN t.completed_at < v_now - interval '2 days' OR random() < 0.6 THEN t.completed_at + interval '15 minutes' END
  FROM trips t WHERE t.status = 'completed' AND t.completed_at > v_now - interval '14 days';

  INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
  SELECT de.driver_id, 'payment', 'You earned ' || de.net_earning::int || ' BDT',
         'Trip ' || t.trip_code || ': ' || de.gross_fare::int || ' BDT fare, ' || de.commission_amount::int || ' BDT commission.',
         jsonb_build_object('tripCode', t.trip_code), de.earned_at,
         CASE WHEN de.earned_at < v_now - interval '1 day' OR random() < 0.5 THEN de.earned_at + interval '30 minutes' END
  FROM driver_earnings de JOIN trips t ON t.id = de.trip_id WHERE de.earned_at > v_now - interval '10 days';

  INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
  SELECT p.user_id, 'promo', x.title, x.body, jsonb_build_object('code', x.code), v_now - x.ago,
         CASE WHEN random() < 0.4 THEN v_now - x.ago + interval '2 hours' END
  FROM _pax p
  CROSS JOIN (VALUES
    ('WEEKEND25', 'Weekend offer: 25% off Car rides', 'Use WEEKEND25 on your next Car ride, up to 80 BDT off.', interval '4 days'),
    ('RAINYDAY',  'Rainy day? Ride for less',          'Use RAINYDAY for 10% off, up to 40 BDT, until the weather clears.', interval '1 day')
  ) AS x(code, title, body, ago)
  WHERE NOT p.susp AND p.joined_at < v_now - x.ago;

  INSERT INTO notifications (user_id, category, title, body, created_at, read_at)
  SELECT dp.user_id, 'document',
         CASE dp.verification_status WHEN 'approved' THEN 'Your driver profile was approved' WHEN 'rejected' THEN 'Your application was not approved' ELSE 'We received your documents' END,
         CASE dp.verification_status WHEN 'approved' THEN 'You can now go online and accept ride requests.'
              WHEN 'rejected' THEN COALESCE(dp.rejection_reason, 'Please review your documents and apply again.')
              ELSE 'Our team will review your documents within 24 hours.' END,
         COALESCE(dp.verified_at, dp.created_at + interval '10 minutes'),
         CASE WHEN dp.verification_status <> 'pending' THEN COALESCE(dp.verified_at, dp.created_at) + interval '1 hour' END
  FROM driver_profiles dp WHERE dp.user_id IN (SELECT user_id FROM _drv);

  INSERT INTO notifications (user_id, category, title, body, payload, created_at, read_at)
  SELECT w.driver_id, 'payment',
         CASE w.status WHEN 'requested' THEN 'Withdrawal requested' WHEN 'approved' THEN 'Withdrawal approved' WHEN 'paid' THEN 'Withdrawal paid'
                       WHEN 'rejected' THEN 'Withdrawal rejected' ELSE 'Withdrawal could not be paid' END,
         CASE w.status WHEN 'requested' THEN w.amount::int || ' BDT is on hold while we review your request.'
                       WHEN 'approved' THEN 'Your ' || w.amount::int || ' BDT withdrawal was approved and is being sent to your payout account.'
                       WHEN 'paid' THEN w.amount::int || ' BDT was sent to your payout account (reference ' || COALESCE(w.gateway_ref, '-') || ').'
                       WHEN 'rejected' THEN 'Your ' || w.amount::int || ' BDT withdrawal was not approved: ' || COALESCE(w.rejection_reason, '') || '. The money is back in your wallet.'
                       ELSE 'We could not send your ' || w.amount::int || ' BDT withdrawal: ' || COALESCE(w.rejection_reason, '') || '. The money is back in your wallet.' END,
         jsonb_build_object('withdrawalId', w.id::text), COALESCE(w.processed_at, w.requested_at),
         CASE WHEN w.status IN ('paid', 'rejected', 'failed') THEN COALESCE(w.processed_at, w.requested_at) + interval '2 hours' END
  FROM withdrawals w WHERE w.driver_id IN (SELECT user_id FROM _drv);

  INSERT INTO notifications (user_id, category, title, body, payload, created_at)
  SELECT a.user_id, 'safety', 'New SOS alert', 'An SOS alert needs immediate attention.', jsonb_build_object('alertId', s.id, 'triggeredBy', s.triggered_by), s.triggered_at
  FROM sos_alerts s CROSS JOIN (VALUES (v_super), (v_sup)) AS a(user_id) WHERE s.status IN ('active', 'acknowledged');
  INSERT INTO notifications (user_id, category, title, body, payload, created_at)
  SELECT a.user_id, 'document', 'New driver application', u.full_name || ' is waiting for document review.', jsonb_build_object('driverId', u.id), dp.created_at + interval '10 minutes'
  FROM driver_profiles dp JOIN users u ON u.id = dp.user_id CROSS JOIN (VALUES (v_super), (v_sup)) AS a(user_id)
  WHERE dp.verification_status = 'pending';

  -- Login sessions
  INSERT INTO login_sessions (user_id, device_type, device_name, ip_address, user_agent, logged_in_at, logged_out_at, is_active)
  SELECT u.id, x.dt::device_type, x.dn, ('103.' || (100 + u.id % 100) || '.' || (10 + u.id % 200) || '.' || (2 + u.id % 250))::inet,
         'Cholo/1.4 (' || x.dn || ')', u.last_login_at,
         CASE WHEN u.id % 3 = 0 THEN u.last_login_at + interval '2 hours' END, u.id % 3 <> 0
  FROM users u
  CROSS JOIN LATERAL (SELECT * FROM (VALUES ('android', 'Samsung Galaxy A34'), ('android', 'Xiaomi Redmi Note 12'), ('ios', 'iPhone 13'),
                                            ('android', 'Realme C55'), ('web', 'Chrome on Windows')) AS q(dt, dn)
                      OFFSET (u.id % 5) LIMIT 1) x
  WHERE u.last_login_at IS NOT NULL
    AND (u.phone IN (SELECT phone FROM _pax UNION ALL SELECT phone FROM _drv) OR u.id IN (v_super, v_fin, v_sup));

  -- Timestamps for rows created with default now()
  UPDATE zones SET created_at = v_now - interval '150 days' WHERE created_at = v_now;
  UPDATE pricing_rules SET created_at = effective_from - interval '5 days' WHERE created_at = v_now;
  UPDATE commission_rules SET created_at = effective_from - interval '5 days' WHERE created_at = v_now;

  -- Audit trail
  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_super, 'ADMIN', CASE WHEN dp.verification_status = 'rejected' THEN 'DRIVER_REJECTED' ELSE 'DRIVER_APPROVED' END,
         'driver_profiles', dp.user_id, jsonb_build_object('status', 'pending'),
         CASE WHEN dp.verification_status = 'rejected' THEN jsonb_build_object('status', 'rejected', 'reason', dp.rejection_reason)
              ELSE jsonb_build_object('status', 'approved') END,
         '103.145.210.14'::inet, dp.verified_at
  FROM driver_profiles dp WHERE dp.user_id IN (SELECT user_id FROM _drv) AND dp.verified_at IS NOT NULL
    AND dp.verification_status IN ('approved', 'rejected', 'suspended');

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_super, 'ADMIN', 'DRIVER_DOCUMENT_APPROVED', 'driver_documents', dd.id, jsonb_build_object('status', 'pending'),
         jsonb_build_object('status', 'approved'), '103.145.210.14'::inet, dd.reviewed_at
  FROM driver_documents dd WHERE dd.status = 'approved' AND dd.doc_type = 'license' AND dd.driver_id IN (SELECT user_id FROM _drv)
    AND dd.reviewed_at IS NOT NULL;

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_super, 'ADMIN', 'VEHICLE_APPROVED', 'vehicles', v.id, jsonb_build_object('status', 'pending'),
         jsonb_build_object('status', 'approved'), '103.145.210.14'::inet, v.created_at + interval '2 days'
  FROM vehicles v WHERE v.verification_status = 'approved' AND v.driver_id IN (SELECT user_id FROM _drv)
    AND v.created_at + interval '2 days' < v_now;

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_fin, 'ADMIN', a.action, 'withdrawals', w.id, jsonb_build_object('status', a.old_status),
         jsonb_build_object('status', a.new_status, 'reason', w.rejection_reason, 'reference', w.gateway_ref),
         '103.145.210.22'::inet, a.at
  FROM withdrawals w
  CROSS JOIN LATERAL (VALUES
    ('WITHDRAWAL_APPROVED', 'requested', 'approved', w.requested_at + interval '1 hour', w.status IN ('approved', 'paid', 'failed')),
    ('WITHDRAWAL_PAID',     'approved',  'paid',     w.processed_at,                     w.status = 'paid'),
    ('WITHDRAWAL_FAILED',   'approved',  'failed',   w.processed_at,                     w.status = 'failed'),
    ('WITHDRAWAL_REJECTED', 'requested', 'rejected', w.processed_at,                     w.status = 'rejected')
  ) AS a(action, old_status, new_status, at, applies)
  WHERE a.applies AND w.driver_id IN (SELECT user_id FROM _drv) AND a.at IS NOT NULL;

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT COALESCE(d.resolved_by, v_sup), 'ADMIN', a.action, 'disputes', d.id, jsonb_build_object('status', a.old_status),
         jsonb_build_object('status', a.new_status, 'resolutionNote', d.resolution_note), '103.145.210.31'::inet, a.at
  FROM disputes d
  CROSS JOIN LATERAL (VALUES
    ('DISPUTE_REVIEW_STARTED', 'open',         'under_review', d.review_started_at, d.review_started_at IS NOT NULL),
    ('DISPUTE_RESOLVED',       'under_review', d.status::text, d.resolved_at,       d.resolved_at IS NOT NULL)
  ) AS a(action, old_status, new_status, at, applies)
  WHERE a.applies AND d.trip_id IN (SELECT id FROM trips WHERE passenger_id IN (SELECT user_id FROM _pax) OR driver_id IN (SELECT user_id FROM _drv));

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_super, 'ADMIN', 'USER_SUSPENDED', 'users', u.id, jsonb_build_object('status', 'active'),
         jsonb_build_object('status', 'suspended', 'reason', u.suspension_reason), '103.145.210.14'::inet,
         COALESCE(u.suspended_until - interval '10 days', v_now - interval '9 days')
  FROM users u WHERE u.status = 'suspended' AND u.phone IN (SELECT phone FROM _pax UNION ALL SELECT phone FROM _drv);

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_super, 'ADMIN', 'PRICING_RULE_PUBLISHED', 'pricing_rules', pr.id, NULL,
         jsonb_build_object('cityId', pr.city_id, 'categoryId', pr.category_id, 'baseFare', pr.base_fare, 'perKmRate', pr.per_km_rate,
                            'perMinRate', pr.per_min_rate, 'minimumFare', pr.minimum_fare),
         '103.145.210.14'::inet, pr.effective_from - interval '5 days'
  FROM pricing_rules pr WHERE pr.city_id IN (v_ctg, v_syl);

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT v_super, 'ADMIN', 'ZONE_CREATED', 'zones', z.id, NULL, jsonb_build_object('name', z.name, 'zoneType', z.zone_type),
         '103.145.210.14'::inet, z.created_at
  FROM zones z WHERE z.city_id IN (v_dhaka, v_ctg, v_syl) AND z.created_at = v_now - interval '150 days';

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, ip_address, created_at)
  SELECT s.acknowledged_by, 'ADMIN',
         CASE s.status WHEN 'false_alarm' THEN 'SOS_MARKED_FALSE_ALARM' WHEN 'resolved' THEN 'SOS_RESOLVED' ELSE 'SOS_ACKNOWLEDGED' END,
         'sos_alerts', s.id, jsonb_build_object('status', 'active'), jsonb_build_object('status', s.status, 'note', s.resolution_note),
         '103.145.210.31'::inet, COALESCE(s.resolved_at, s.triggered_at + interval '4 minutes')
  FROM sos_alerts s WHERE s.acknowledged_by IS NOT NULL;

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, old_value, new_value, created_at)
  SELECT t.passenger_id, 'PASSENGER', 'TRIP_ARRIVAL_DISPUTED', 'trips', t.id,
         jsonb_build_object('status', 'arrived'), jsonb_build_object('status', 'assigned', 'arrivalDisputedAt', t.arrival_disputed_at),
         t.arrival_disputed_at
  FROM trips t WHERE t.arrival_disputed_at IS NOT NULL;

  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_value, ip_address)
  VALUES (v_super, 'ADMIN', 'DEMO_DATASET_SEEDED', 'users', v_super,
          jsonb_build_object('passengers', (SELECT count(*) FROM _pax), 'drivers', (SELECT count(*) FROM _drv),
                             'trips', (SELECT count(*) FROM trips), 'seededAt', v_now), '127.0.0.1');

  DROP TABLE IF EXISTS pg_temp._loc, pg_temp._pax, pg_temp._drv, pg_temp._ev, pg_temp._bal, pg_temp._surged, pg_temp._tk;

  RAISE NOTICE 'seed.demo.sql: demo dataset loaded.';
END $demo$;

DROP SCHEMA IF EXISTS cholo_demo_seed CASCADE;
