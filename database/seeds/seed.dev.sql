-- Development/demo data only — never run this against production.
-- Idempotent: re-running repairs the three demo identities and only creates
-- missing showcase rows. Password for every demo account: DemoPass123
BEGIN;

DO $$
DECLARE
  v_nusrat bigint;
  v_rafiq bigint;
  v_admin bigint;
  v_city smallint;
  v_category smallint;
  v_vehicle bigint;
  v_request bigint;
  v_trip bigint;
  v_payment bigint;
  v_commission bigint;
  v_wallet bigint;
  v_account bigint;
  v_withdrawal bigint;
  v_ticket bigint;
BEGIN
  -- M8's first local draft used a phone that an older API test fixture also
  -- uses. Move that same demo identity before the idempotent upsert so
  -- existing developer volumes become test-safe too.
  UPDATE users SET phone = '01510009993'
  WHERE email = 'admin.demo@cholo.local' AND phone = '01910000003';

  SELECT id INTO v_city FROM cities WHERE name = 'Dhaka';
  SELECT id INTO v_category FROM vehicle_categories WHERE name = 'Car';
  IF v_city IS NULL OR v_category IS NULL THEN
    RAISE EXCEPTION 'Run seed.reference.sql before seed.dev.sql';
  END IF;

  INSERT INTO users (full_name, phone, email, password_hash, gender, phone_verified_at, referral_code, status)
  VALUES ('Nusrat Jahan', '01710000001', 'nusrat.demo@cholo.local', '$2b$12$WOaMwC4X4gaEJTpE9DGw/uGTxEDN49DOkjppNvr3z3.gcD4qoF/ce', 'female', now(), 'NUSRAT26', 'active')
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash, status = 'active', deleted_at = NULL
  RETURNING id INTO v_nusrat;

  INSERT INTO users (full_name, phone, email, password_hash, gender, phone_verified_at, referral_code, status)
  VALUES ('Rafiq Islam', '01810000002', 'rafiq.demo@cholo.local', '$2b$12$WOaMwC4X4gaEJTpE9DGw/uGTxEDN49DOkjppNvr3z3.gcD4qoF/ce', 'male', now(), 'RAFIQ26', 'active')
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash, status = 'active', deleted_at = NULL
  RETURNING id INTO v_rafiq;

  INSERT INTO users (full_name, phone, email, password_hash, phone_verified_at, status)
  VALUES ('Ayesha Admin', '01510009993', 'admin.demo@cholo.local', '$2b$12$WOaMwC4X4gaEJTpE9DGw/uGTxEDN49DOkjppNvr3z3.gcD4qoF/ce', now(), 'active')
  ON CONFLICT (phone) DO UPDATE SET full_name = EXCLUDED.full_name, email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash, status = 'active', deleted_at = NULL
  RETURNING id INTO v_admin;

  INSERT INTO user_roles (user_id, role_id)
  SELECT v_nusrat, id FROM roles WHERE name = 'PASSENGER' ON CONFLICT DO NOTHING;
  INSERT INTO user_roles (user_id, role_id)
  SELECT v_rafiq, id FROM roles WHERE name = 'DRIVER' ON CONFLICT DO NOTHING;
  INSERT INTO user_roles (user_id, role_id)
  SELECT v_admin, id FROM roles WHERE name = 'ADMIN' ON CONFLICT DO NOTHING;

  INSERT INTO passenger_profiles (user_id, default_city_id)
  VALUES (v_nusrat, v_city) ON CONFLICT (user_id) DO UPDATE SET default_city_id = EXCLUDED.default_city_id;
  INSERT INTO driver_profiles
    (user_id, nid_number, license_number, license_expiry, verification_status, verified_by, verified_at, total_trips)
  VALUES (v_rafiq, '1987654321', 'DHAKA-DEMO-RAFIQ', current_date + 730, 'approved', v_admin, now(), 1)
  ON CONFLICT (user_id) DO UPDATE SET verification_status = 'approved', verified_by = v_admin,
    verified_at = now(), license_expiry = EXCLUDED.license_expiry;
  INSERT INTO admin_profiles (user_id, designation, access_level)
  VALUES (v_admin, 'Demo Super Admin', 'super')
  ON CONFLICT (user_id) DO UPDATE SET designation = EXCLUDED.designation, access_level = 'super';

  INSERT INTO driver_documents
    (driver_id, doc_type, doc_number, file_url, expiry_date, status, reviewed_by, reviewed_at)
  SELECT v_rafiq, d.doc_type::driver_doc_type, d.doc_number,
         'https://example.com/cholo/demo/' || d.doc_type || '.pdf', d.expiry_date, 'approved', v_admin, now()
  FROM (VALUES
    ('license', 'DHAKA-DEMO-RAFIQ', current_date + 730),
    ('nid', '1987654321', NULL::date),
    ('photo', 'RAFIQ-PHOTO', NULL::date),
    ('police_clearance', 'PC-DEMO-2026', current_date + 365)
  ) AS d(doc_type, doc_number, expiry_date)
  WHERE NOT EXISTS (SELECT 1 FROM driver_documents existing WHERE existing.driver_id = v_rafiq AND existing.doc_type::text = d.doc_type);

  INSERT INTO vehicles
    (driver_id, category_id, registration_no, brand, model, model_year, color, verification_status, is_active)
  VALUES (v_rafiq, v_category, 'DHAKA-METRO-GA-DEMO', 'Toyota', 'Axio', 2022, 'White', 'approved', true)
  ON CONFLICT (registration_no) DO UPDATE SET verification_status = 'approved', is_active = true
  RETURNING id INTO v_vehicle;

  INSERT INTO vehicle_documents
    (vehicle_id, doc_type, doc_number, file_url, expiry_date, status, reviewed_by, reviewed_at)
  SELECT v_vehicle, d.doc_type::vehicle_doc_type, d.doc_number,
         'https://example.com/cholo/demo/vehicle-' || d.doc_type || '.pdf', current_date + 365, 'approved', v_admin, now()
  FROM (VALUES ('registration', 'REG-DEMO'), ('fitness', 'FIT-DEMO'), ('insurance', 'INS-DEMO'), ('tax_token', 'TAX-DEMO')) AS d(doc_type, doc_number)
  WHERE NOT EXISTS (SELECT 1 FROM vehicle_documents existing WHERE existing.vehicle_id = v_vehicle AND existing.doc_type::text = d.doc_type);

  UPDATE driver_profiles SET active_vehicle_id = v_vehicle WHERE user_id = v_rafiq;
  UPDATE driver_availability SET status = 'offline', current_lat = 23.746100, current_lng = 90.374200,
    heading = 35, last_ping_at = now() WHERE driver_id = v_rafiq;

  INSERT INTO emergency_contacts (user_id, name, phone, relationship, priority)
  VALUES (v_nusrat, 'Farhana Jahan', '01610000004', 'Sister', 1) ON CONFLICT (user_id, phone) DO NOTHING;

  SELECT id INTO v_wallet FROM wallets WHERE user_id = v_nusrat;
  INSERT INTO wallet_transactions
    (wallet_id, txn_type, direction, amount, balance_after, reference_type, idempotency_key, note)
  VALUES (v_wallet, 'topup', 'credit', 2000, 0, 'manual', 'demo-nusrat-opening-balance', 'Demo opening balance')
  ON CONFLICT (idempotency_key) DO NOTHING;
  SELECT id INTO v_wallet FROM wallets WHERE user_id = v_rafiq;
  INSERT INTO wallet_transactions
    (wallet_id, txn_type, direction, amount, balance_after, reference_type, idempotency_key, note)
  VALUES (v_wallet, 'topup', 'credit', 1500, 0, 'manual', 'demo-rafiq-opening-balance', 'Demo opening balance')
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT t.id INTO v_trip FROM trips t JOIN ride_requests rr ON rr.id = t.request_id
  WHERE rr.passenger_id = v_nusrat AND rr.pickup_address = 'Demo: Dhanmondi 27' LIMIT 1;
  IF v_trip IS NULL THEN
    INSERT INTO ride_requests
      (passenger_id, city_id, category_id, pickup_lat, pickup_lng, pickup_address,
       dropoff_lat, dropoff_lng, dropoff_address, est_distance_km, est_duration_min,
       est_fare, payment_intent, status, requested_at, expires_at)
    VALUES (v_nusrat, v_city, v_category, 23.746100, 90.374200, 'Demo: Dhanmondi 27',
      23.792500, 90.407800, 'Demo: Gulshan 2 Circle', 10.20, 28, 300, 'cash', 'matched',
      now() - interval '2 days 35 minutes', now() - interval '2 days 30 minutes')
    RETURNING id INTO v_request;
    PERFORM set_config('app.user_id', v_rafiq::text, true);
    INSERT INTO trips
      (request_id, passenger_id, driver_id, vehicle_id, status, assigned_at, arrived_at,
       started_at, completed_at, actual_distance_km, actual_duration_min,
       base_fare, distance_fare, time_fare, waiting_fare, surge_amount,
       booking_fee, discount_amount, total_fare, payment_status)
    VALUES (v_request, v_nusrat, v_rafiq, v_vehicle, 'completed',
      now() - interval '2 days 30 minutes', now() - interval '2 days 20 minutes',
      now() - interval '2 days 18 minutes', now() - interval '2 days', 10.40, 30,
      50, 180, 60, 0, 0, 10, 20, 280, 'paid') RETURNING id INTO v_trip;
  END IF;

  SELECT id INTO v_payment FROM payments WHERE trip_id = v_trip AND status = 'succeeded' LIMIT 1;
  IF v_payment IS NULL THEN
    INSERT INTO payments (purpose, trip_id, payer_id, method_type, gateway, amount, status, completed_at)
    VALUES ('trip', v_trip, v_nusrat, 'cash', 'none', 280, 'succeeded', now() - interval '2 days')
    RETURNING id INTO v_payment;
  END IF;

  SELECT id INTO v_commission FROM commission_rules
  WHERE category_id = v_category AND (city_id = v_city OR city_id IS NULL)
  ORDER BY city_id NULLS LAST, effective_from DESC LIMIT 1;
  INSERT INTO driver_earnings
    (trip_id, driver_id, gross_fare, commission_rule_id, commission_pct, commission_amount, net_earning, earned_at)
  VALUES (v_trip, v_rafiq, 280, v_commission, 15, 42, 238, now() - interval '2 days')
  ON CONFLICT (trip_id) DO NOTHING;
  SELECT id INTO v_wallet FROM wallets WHERE user_id = v_rafiq;
  INSERT INTO wallet_transactions
    (wallet_id, txn_type, direction, amount, balance_after, reference_type, reference_id, idempotency_key, note)
  VALUES (v_wallet, 'commission', 'debit', 42, 0, 'trip', v_trip, 'demo-trip-commission', 'Commission for demo cash trip')
  ON CONFLICT (idempotency_key) DO NOTHING;
  INSERT INTO receipts (trip_id, issued_to, subtotal, discount, total)
  VALUES (v_trip, v_nusrat, 300, 20, 280) ON CONFLICT (trip_id) DO NOTHING;
  INSERT INTO ratings (trip_id, rater_id, ratee_id, rater_role, score, comment)
  VALUES (v_trip, v_nusrat, v_rafiq, 'passenger', 5, 'Safe and friendly demo ride')
  ON CONFLICT (trip_id, rater_id) DO NOTHING;

  INSERT INTO driver_payout_accounts
    (driver_id, account_type, account_name, account_no_masked, is_default, is_verified)
  SELECT v_rafiq, 'bkash', 'Rafiq Islam', '018******02', true, true
  WHERE NOT EXISTS (SELECT 1 FROM driver_payout_accounts WHERE driver_id = v_rafiq AND account_type = 'bkash' AND account_name = 'Rafiq Islam')
  RETURNING id INTO v_account;
  IF v_account IS NULL THEN SELECT id INTO v_account FROM driver_payout_accounts WHERE driver_id = v_rafiq AND account_type = 'bkash' AND account_name = 'Rafiq Islam' ORDER BY id LIMIT 1; END IF;
  UPDATE driver_payout_accounts SET account_no_masked = '********002'
  WHERE id = v_account;
  SELECT id INTO v_withdrawal FROM withdrawals WHERE driver_id = v_rafiq AND payout_account_id = v_account AND status = 'requested' LIMIT 1;
  IF v_withdrawal IS NULL THEN
    INSERT INTO withdrawals (driver_id, payout_account_id, amount) VALUES (v_rafiq, v_account, 300) RETURNING id INTO v_withdrawal;
  END IF;
  INSERT INTO wallet_transactions
    (wallet_id, txn_type, direction, amount, balance_after, reference_type, reference_id, idempotency_key, note)
  VALUES (v_wallet, 'withdrawal', 'debit', 300, 0, 'withdrawal', v_withdrawal, 'demo-withdrawal-hold', 'Demo payout request hold')
  ON CONFLICT (idempotency_key) DO NOTHING;

  SELECT id INTO v_ticket FROM support_tickets WHERE user_id = v_nusrat AND subject = 'Demo: left an umbrella' LIMIT 1;
  IF v_ticket IS NULL THEN
    INSERT INTO support_tickets (user_id, trip_id, category, subject, description, priority)
    VALUES (v_nusrat, v_trip, 'ride', 'Demo: left an umbrella', 'I may have left a black umbrella in the car.', 'medium')
    RETURNING id INTO v_ticket;
    INSERT INTO support_ticket_messages (ticket_id, sender_id, body)
    VALUES (v_ticket, v_nusrat, 'I may have left a black umbrella in the car.');
  END IF;
  INSERT INTO disputes (trip_id, raised_by, dispute_type, description, disputed_amount)
  SELECT v_trip, v_nusrat, 'fare_overcharge', 'Demo dispute: waiting charge looks incorrect.', 20
  WHERE NOT EXISTS (SELECT 1 FROM disputes WHERE trip_id = v_trip AND raised_by = v_nusrat);
  INSERT INTO sos_alerts (trip_id, triggered_by, lat, lng)
  SELECT v_trip, v_nusrat, 23.780600, 90.407000
  WHERE NOT EXISTS (SELECT 1 FROM sos_alerts WHERE trip_id = v_trip AND triggered_by = v_nusrat);
  INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, new_value)
  SELECT v_admin, 'ADMIN', 'DEMO_WORLD_SEEDED', 'users', v_nusrat,
    jsonb_build_object('passenger', 'Nusrat Jahan', 'driver', 'Rafiq Islam')
  WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action = 'DEMO_WORLD_SEEDED' AND actor_id = v_admin);
END $$;

COMMIT;
