-- =============================================================================
-- Cholo (চলো) — Ride-Sharing Platform
-- database/schema.sql
--
-- GENERATED FROM THE PROJECT BLUEPRINT. Do not hand-edit structure here without
-- updating the source docs first:
--   docs/01-er-diagram-database-architecture.md      (51 entities, 7 domains,
--                                                      101 documented FK relationships)
--   docs/02-03-normalization-schema-transactions.md  (normalization proof,
--                                                      DDL mapping rules, constraint
--                                                      toolbox, transactions)
--
-- Target: PostgreSQL 16.
-- Scope of this file: every CREATE TABLE, constraint, index, trigger and view
-- described in the two docs above. Nothing here is invented beyond them — where
-- a doc gives a general rule ("every FK used in joins has one index", "every
-- natural key is UNIQUE") it is applied consistently; where a doc gives an
-- exact name (chk_fare_identity, ux_payment_one_success, idx_trips_driver, ...)
-- that exact name is used.
--
-- Tables are created in FK-dependency order, not domain order (a few columns
-- — e.g. passenger_profiles.default_city_id — reach into a later domain).
-- The one unavoidable cycle (driver_profiles.active_vehicle_id <-> vehicles)
-- is resolved the way doc 03 §1 describes: driver_profiles is created with
-- the column but no constraint, vehicles is created next, then the FK is
-- added with ALTER TABLE.
-- =============================================================================


-- =============================================================================
-- 0. ENUM TYPES
-- Closed vocabularies from every domain (doc 01), grouped by the domain that
-- introduces them. A VARCHAR status can hold 'complated'; an ENUM physically
-- cannot (doc 03 §3).
-- =============================================================================

-- Domain 1 — Identity & Access
CREATE TYPE user_gender AS ENUM ('female', 'male', 'other');
CREATE TYPE preferred_language AS ENUM ('bn', 'en');
CREATE TYPE user_status AS ENUM ('active', 'suspended', 'deleted');
CREATE TYPE driver_verification_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE admin_access_level AS ENUM ('super', 'ops', 'finance', 'support');
CREATE TYPE otp_purpose AS ENUM ('signup', 'login', 'password_reset', 'payout');
CREATE TYPE device_type AS ENUM ('android', 'ios', 'web');

-- Domain 2 — Fleet & Compliance
CREATE TYPE vehicle_verification_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE driver_doc_type AS ENUM ('license', 'nid', 'photo', 'police_clearance');
CREATE TYPE vehicle_doc_type AS ENUM ('registration', 'fitness', 'insurance', 'tax_token');
-- shared by driver_documents.status and vehicle_documents.status (identical value sets)
CREATE TYPE document_status AS ENUM ('pending', 'approved', 'rejected', 'expired');
CREATE TYPE driver_availability_status AS ENUM ('offline', 'online', 'on_trip', 'break');

-- Domain 3 — Geography & Pricing
CREATE TYPE zone_type AS ENUM ('regular', 'airport', 'station', 'restricted');
CREATE TYPE surge_reason AS ENUM ('demand', 'weather', 'event', 'peak_hour');

-- Domain 4 — Ride Lifecycle
-- shared by ride_requests.payment_intent and payments.method_type (identical value sets)
CREATE TYPE payment_channel AS ENUM ('cash', 'wallet', 'bkash', 'nagad', 'card');
CREATE TYPE ride_request_status AS ENUM ('pending', 'searching', 'matched', 'expired', 'cancelled');
CREATE TYPE offer_response AS ENUM ('pending', 'accepted', 'rejected', 'timed_out', 'withdrawn');
CREATE TYPE trip_status AS ENUM ('assigned', 'arrived', 'in_progress', 'completed', 'cancelled');
CREATE TYPE trip_payment_status AS ENUM ('unpaid', 'paid', 'refunded');
CREATE TYPE cancelled_by_role AS ENUM ('passenger', 'driver', 'system', 'admin');
CREATE TYPE cancellation_reason_code AS ENUM
    ('changed_mind', 'driver_late', 'no_show', 'wrong_pickup', 'vehicle_issue', 'other');
CREATE TYPE trip_message_type AS ENUM ('text', 'quick_reply', 'location');

-- Domain 5 — Payments, Wallet & Settlement
CREATE TYPE payment_instrument_type AS ENUM ('bkash', 'nagad', 'card');
CREATE TYPE payment_instrument_provider AS ENUM ('bkash', 'nagad', 'sslcommerz');
CREATE TYPE payment_purpose AS ENUM ('trip', 'wallet_topup');
CREATE TYPE payment_gateway AS ENUM ('none', 'bkash', 'nagad', 'sslcommerz');
CREATE TYPE payment_status AS ENUM ('initiated', 'pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE wallet_status AS ENUM ('active', 'frozen');
CREATE TYPE wallet_txn_type AS ENUM
    ('topup', 'trip_payment', 'trip_earning', 'commission', 'withdrawal',
     'refund', 'promo_credit', 'referral_bonus', 'adjustment');
CREATE TYPE wallet_txn_direction AS ENUM ('credit', 'debit');
CREATE TYPE wallet_txn_reference_type AS ENUM ('trip', 'payment', 'withdrawal', 'promo', 'referral', 'manual');
CREATE TYPE promo_type AS ENUM ('percentage', 'fixed_amount');
CREATE TYPE settlement_status AS ENUM ('pending', 'settled', 'withheld');
CREATE TYPE payout_account_type AS ENUM ('bkash', 'nagad', 'bank');
CREATE TYPE withdrawal_status AS ENUM ('requested', 'approved', 'processing', 'paid', 'rejected', 'failed');
CREATE TYPE invoice_status AS ENUM ('draft', 'finalized', 'paid');

-- Domain 6 — Engagement & Safety
CREATE TYPE rater_role AS ENUM ('passenger', 'driver');
CREATE TYPE referral_status AS ENUM ('pending', 'qualified', 'rewarded');
CREATE TYPE sos_status AS ENUM ('active', 'acknowledged', 'resolved', 'false_alarm');
CREATE TYPE notification_category AS ENUM ('ride', 'payment', 'promo', 'document', 'safety', 'system');
CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'sms', 'email');
CREATE TYPE report_category AS ENUM ('safety', 'harassment', 'fraud', 'behavior', 'other');
CREATE TYPE report_status AS ENUM ('open', 'investigating', 'action_taken', 'dismissed');

-- Domain 7 — Support & Governance
CREATE TYPE ticket_category AS ENUM ('payment', 'ride', 'account', 'driver_conduct', 'app_issue', 'other');
CREATE TYPE ticket_status AS ENUM ('open', 'in_progress', 'waiting_user', 'resolved', 'closed');
CREATE TYPE ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE dispute_type AS ENUM
    ('fare_overcharge', 'payment_failed', 'behavior', 'lost_item', 'service_quality');
CREATE TYPE dispute_status AS ENUM
    ('open', 'under_review', 'resolved_refunded', 'resolved_no_action', 'rejected');


-- =============================================================================
-- 1. SEQUENCES for human-readable document numbers (doc 03 §9)
-- A DEFAULT expression turns a thread-safe counter into a document number,
-- e.g. 'JT-' || year || '-' || padded nextval -> JT-2026-000142.
-- =============================================================================

CREATE SEQUENCE seq_trip_code;
CREATE SEQUENCE seq_receipt_no;
CREATE SEQUENCE seq_invoice_no;
CREATE SEQUENCE seq_ticket_no;
CREATE SEQUENCE seq_dispute_no;


-- =============================================================================
-- 2. DOMAIN 1 — IDENTITY & ACCESS (+ the two lookup tables other domains need)
-- =============================================================================

-- users — one account for every human (passenger, driver, admin). Role-specific
-- data lives in 1:1 extension tables below (doc 01 §13.1).
CREATE TABLE users (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    full_name           VARCHAR(120) NOT NULL,
    phone               VARCHAR(20) NOT NULL UNIQUE,
    email               VARCHAR(255) UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    gender              user_gender,
    date_of_birth       DATE,
    photo_url           TEXT,
    preferred_language  preferred_language NOT NULL DEFAULT 'en',
    status              user_status NOT NULL DEFAULT 'active',
    referral_code       VARCHAR(20) UNIQUE,
    phone_verified_at   TIMESTAMPTZ,
    email_verified_at   TIMESTAMPTZ,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at          TIMESTAMPTZ,
    CONSTRAINT chk_users_phone_format CHECK (phone ~ '^01[3-9][0-9]{8}$')
);

-- roles — RBAC catalog; permissions are separate from profile data (doc 01 §13.2)
CREATE TABLE roles (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(20) NOT NULL UNIQUE,
    description VARCHAR(255)
);

-- user_roles — resolves users<->roles M:N
CREATE TABLE user_roles (
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id     SMALLINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    granted_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_user_roles_granted_by ON user_roles(granted_by);

-- cities — operational market boundary (needed by several domains, created early)
CREATE TABLE cities (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        VARCHAR(60) NOT NULL UNIQUE,
    country     VARCHAR(60) NOT NULL DEFAULT 'Bangladesh',
    timezone    VARCHAR(40) NOT NULL DEFAULT 'Asia/Dhaka',
    currency    CHAR(3) NOT NULL DEFAULT 'BDT',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    launched_at DATE
);

-- vehicle_categories — Bike / CNG / Car / Car-Premium (needed by several domains)
CREATE TABLE vehicle_categories (
    id            SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name          VARCHAR(40) NOT NULL UNIQUE,
    description   VARCHAR(255),
    seat_capacity SMALLINT,
    icon_url      TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    sort_order    SMALLINT NOT NULL DEFAULT 0
);

-- passenger_profiles — 1:1 extension of users
CREATE TABLE passenger_profiles (
    user_id         BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    rating_avg      NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    rating_count    INT NOT NULL DEFAULT 0,
    total_trips     INT NOT NULL DEFAULT 0,
    default_city_id SMALLINT REFERENCES cities(id) ON DELETE SET NULL,
    women_only_mode BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_passenger_profiles_default_city ON passenger_profiles(default_city_id);

-- driver_profiles — 1:1 extension of users; KYC + performance metrics.
-- active_vehicle_id is added WITHOUT a constraint here; the FK to vehicles is
-- added later with ALTER TABLE once vehicles exists (circular reference,
-- doc 03 §1).
CREATE TABLE driver_profiles (
    user_id             BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    nid_number          VARCHAR(20) NOT NULL UNIQUE,
    license_number      VARCHAR(30) NOT NULL UNIQUE,
    license_expiry      DATE,
    verification_status driver_verification_status NOT NULL DEFAULT 'pending',
    verified_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    verified_at         TIMESTAMPTZ,
    active_vehicle_id   BIGINT,
    rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 5.00,
    rating_count        INT NOT NULL DEFAULT 0,
    total_trips         INT NOT NULL DEFAULT 0,
    acceptance_rate     NUMERIC(5,2),
    cancellation_rate   NUMERIC(5,2),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_driver_nid_format CHECK (nid_number ~ '^[0-9]{10}$|^[0-9]{13}$|^[0-9]{17}$')
);

CREATE INDEX idx_driver_profiles_verified_by ON driver_profiles(verified_by);

-- admin_profiles — 1:1 extension of users; staff attributes and access tier
CREATE TABLE admin_profiles (
    user_id     BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    designation VARCHAR(80),
    access_level admin_access_level NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- login_sessions — device/session audit trail
CREATE TABLE login_sessions (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_type    device_type NOT NULL,
    device_name    VARCHAR(120),
    ip_address     INET,
    user_agent     VARCHAR(255),
    logged_in_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    logged_out_at  TIMESTAMPTZ,
    is_active      BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX idx_login_sessions_user ON login_sessions(user_id);

-- refresh_tokens — rotation chain; token hashes only, never raw tokens
CREATE TABLE refresh_tokens (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id   BIGINT NOT NULL REFERENCES login_sessions(id) ON DELETE CASCADE,
    token_hash   CHAR(64) NOT NULL UNIQUE,
    issued_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked_at   TIMESTAMPTZ,
    replaced_by  BIGINT REFERENCES refresh_tokens(id) ON DELETE SET NULL
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_session ON refresh_tokens(session_id);
-- one active refresh token per session (doc 01 §4.1)
CREATE UNIQUE INDEX ux_refresh_active_per_session ON refresh_tokens(session_id)
    WHERE revoked_at IS NULL;

-- password_reset_tokens — single-use, short-lived
CREATE TABLE password_reset_tokens (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  CHAR(64) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_password_reset_tokens_user ON password_reset_tokens(user_id);

-- otp_verifications — phone OTP; user is nullable because OTP can precede signup
CREATE TABLE otp_verifications (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
    phone       VARCHAR(20) NOT NULL,
    otp_hash    VARCHAR(255) NOT NULL,
    purpose     otp_purpose NOT NULL,
    attempts    SMALLINT NOT NULL DEFAULT 0,
    expires_at  TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_otp_verifications_user ON otp_verifications(user_id);
CREATE INDEX idx_otp_verifications_phone ON otp_verifications(phone);


-- =============================================================================
-- 3. DOMAIN 2 — FLEET & COMPLIANCE
-- =============================================================================

-- vehicles — physical vehicle registry; a driver may register several
CREATE TABLE vehicles (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_id           BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE RESTRICT,
    category_id         SMALLINT NOT NULL REFERENCES vehicle_categories(id) ON DELETE RESTRICT,
    registration_no     VARCHAR(30) NOT NULL UNIQUE,
    brand               VARCHAR(60),
    model               VARCHAR(60),
    model_year          SMALLINT,
    color               VARCHAR(30),
    verification_status vehicle_verification_status NOT NULL DEFAULT 'pending',
    is_active           BOOLEAN NOT NULL DEFAULT true,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_driver ON vehicles(driver_id);
CREATE INDEX idx_vehicles_category ON vehicles(category_id);

-- close the circular reference: a driver's active vehicle (doc 03 §1)
ALTER TABLE driver_profiles
    ADD CONSTRAINT fk_driver_profiles_active_vehicle
    FOREIGN KEY (active_vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL;

CREATE INDEX idx_driver_profiles_active_vehicle ON driver_profiles(active_vehicle_id);

-- driver_documents — KYC evidence; re-uploads are new rows (history kept),
-- so (driver_id, doc_type) is deliberately NOT unique (doc 02 §8 row 13)
CREATE TABLE driver_documents (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_id        BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE CASCADE,
    doc_type         driver_doc_type NOT NULL,
    doc_number       VARCHAR(60),
    file_url         TEXT NOT NULL,
    issue_date       DATE,
    expiry_date      DATE,
    status           document_status NOT NULL DEFAULT 'pending',
    reviewed_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at      TIMESTAMPTZ,
    rejection_reason VARCHAR(255),
    uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_documents_driver ON driver_documents(driver_id);
CREATE INDEX idx_driver_documents_reviewed_by ON driver_documents(reviewed_by);

-- vehicle_documents — fitness/insurance/tax papers, same re-upload-history shape
CREATE TABLE vehicle_documents (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    vehicle_id  BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    doc_type    vehicle_doc_type NOT NULL,
    doc_number  VARCHAR(60),
    file_url    TEXT NOT NULL,
    issue_date  DATE,
    expiry_date DATE,
    status      document_status NOT NULL DEFAULT 'pending',
    reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicle_documents_vehicle ON vehicle_documents(vehicle_id);
CREATE INDEX idx_vehicle_documents_reviewed_by ON vehicle_documents(reviewed_by);

-- driver_availability — the hot GPS row, isolated from the stable profile row
-- (doc 01 §5, write-frequency separation). Populated by zones FK below.
CREATE TABLE driver_availability (
    driver_id      BIGINT PRIMARY KEY REFERENCES driver_profiles(user_id) ON DELETE CASCADE,
    status         driver_availability_status NOT NULL DEFAULT 'offline',
    current_lat    NUMERIC(9,6),
    current_lng    NUMERIC(9,6),
    heading        NUMERIC(5,2),
    current_zone_id BIGINT,
    last_ping_at   TIMESTAMPTZ,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- current_zone_id -> zones added after zones is created (see Domain 3 below)


-- =============================================================================
-- 4. DOMAIN 3 — GEOGRAPHY & PRICING
-- =============================================================================

-- zones — sub-city geofences; unit of surge, supply metrics, airport rules
CREATE TABLE zones (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id           SMALLINT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    name              VARCHAR(80) NOT NULL,
    zone_type         zone_type NOT NULL DEFAULT 'regular',
    boundary_geojson  JSONB,
    is_active         BOOLEAN NOT NULL DEFAULT true,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_zones_city_name UNIQUE (city_id, name)
);

CREATE INDEX idx_zones_city ON zones(city_id);

-- now that zones exists, close driver_availability.current_zone_id
ALTER TABLE driver_availability
    ADD CONSTRAINT fk_driver_availability_zone
    FOREIGN KEY (current_zone_id) REFERENCES zones(id) ON DELETE SET NULL;

-- THE dispatch query: online drivers in this zone (doc 03 §5)
CREATE INDEX idx_availability_dispatch ON driver_availability (current_zone_id, status)
    WHERE status = 'online';

-- saved_places — Home/Work shortcuts; the only reusable location entity (doc 01 §13.6)
CREATE TABLE saved_places (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label        VARCHAR(40) NOT NULL,
    address_text VARCHAR(255) NOT NULL,
    lat          NUMERIC(9,6) NOT NULL,
    lng          NUMERIC(9,6) NOT NULL,
    is_default   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_saved_places_user_label UNIQUE (user_id, label)
);

-- pricing_rules — effective-dated tariff card per city+category (doc 01 §13.7)
CREATE TABLE pricing_rules (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    city_id            SMALLINT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    category_id        SMALLINT NOT NULL REFERENCES vehicle_categories(id) ON DELETE RESTRICT,
    base_fare          NUMERIC(12,2) NOT NULL,
    per_km_rate        NUMERIC(12,2) NOT NULL,
    per_min_rate       NUMERIC(12,2) NOT NULL,
    minimum_fare       NUMERIC(12,2) NOT NULL,
    booking_fee        NUMERIC(12,2) NOT NULL DEFAULT 0,
    waiting_per_min    NUMERIC(12,2) NOT NULL DEFAULT 0,
    free_wait_minutes  SMALLINT NOT NULL DEFAULT 0,
    cancellation_fee   NUMERIC(12,2) NOT NULL DEFAULT 0,
    effective_from     TIMESTAMPTZ NOT NULL,
    effective_to       TIMESTAMPTZ,
    is_active          BOOLEAN NOT NULL DEFAULT true,
    created_by         BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_pricing_rules_identity UNIQUE (city_id, category_id, effective_from),
    CONSTRAINT chk_pricing_effective_window CHECK (effective_to IS NULL OR effective_to > effective_from)
);

CREATE INDEX idx_pricing_rules_city ON pricing_rules(city_id);
CREATE INDEX idx_pricing_rules_category ON pricing_rules(category_id);
CREATE INDEX idx_pricing_rules_created_by ON pricing_rules(created_by);

-- surge_pricing — temporary multiplier per zone; the applied value is
-- snapshotted onto each request (doc 01 §13.7)
CREATE TABLE surge_pricing (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    zone_id     BIGINT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
    category_id SMALLINT REFERENCES vehicle_categories(id) ON DELETE CASCADE,
    multiplier  NUMERIC(3,2) NOT NULL,
    reason      surge_reason NOT NULL,
    starts_at   TIMESTAMPTZ NOT NULL,
    ends_at     TIMESTAMPTZ,
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_surge_multiplier_range CHECK (multiplier BETWEEN 1.00 AND 5.00),
    CONSTRAINT chk_surge_window CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX idx_surge_pricing_zone ON surge_pricing(zone_id);
CREATE INDEX idx_surge_pricing_category ON surge_pricing(category_id);
CREATE INDEX idx_surge_pricing_created_by ON surge_pricing(created_by);

-- commission_rules — platform's percentage cut; effective-dated
CREATE TABLE commission_rules (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    category_id     SMALLINT NOT NULL REFERENCES vehicle_categories(id) ON DELETE RESTRICT,
    city_id         SMALLINT REFERENCES cities(id) ON DELETE RESTRICT,
    commission_pct  NUMERIC(5,2) NOT NULL,
    effective_from  TIMESTAMPTZ NOT NULL,
    effective_to    TIMESTAMPTZ,
    created_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_commission_effective_window CHECK (effective_to IS NULL OR effective_to > effective_from)
);

-- UNIQUE NULLS NOT DISTINCT (PG15+): city_id NULL means countrywide, and two
-- countrywide rules for the same category+start must still collide (doc 03 §4)
CREATE UNIQUE INDEX uq_commission_rules_identity ON commission_rules (category_id, city_id, effective_from)
    NULLS NOT DISTINCT;

CREATE INDEX idx_commission_rules_category ON commission_rules(category_id);
CREATE INDEX idx_commission_rules_city ON commission_rules(city_id);
CREATE INDEX idx_commission_rules_created_by ON commission_rules(created_by);


-- =============================================================================
-- 5. DOMAIN 4 — RIDE LIFECYCLE
-- A ride is three things: ride_requests (demand), ride_offers (dispatch),
-- trips (fulfillment) — doc 01 §7 and §13.3–13.4.
-- =============================================================================

-- promo_codes is defined here (ahead of Domain 5) because ride_requests
-- references it (promo is reserved at booking time).
CREATE TABLE promo_codes (
    id                    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code                  VARCHAR(30) NOT NULL UNIQUE,
    description           VARCHAR(255),
    promo_type            promo_type NOT NULL,
    value                 NUMERIC(12,2) NOT NULL,
    max_discount          NUMERIC(12,2),
    min_fare              NUMERIC(12,2),
    usage_limit_total     INT,
    usage_limit_per_user  SMALLINT,
    first_ride_only       BOOLEAN NOT NULL DEFAULT false,
    city_id               SMALLINT REFERENCES cities(id) ON DELETE SET NULL,
    category_id           SMALLINT REFERENCES vehicle_categories(id) ON DELETE SET NULL,
    valid_from            TIMESTAMPTZ NOT NULL,
    valid_until           TIMESTAMPTZ,
    is_active             BOOLEAN NOT NULL DEFAULT true,
    created_by            BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_promo_codes_city ON promo_codes(city_id);
CREATE INDEX idx_promo_codes_category ON promo_codes(category_id);
CREATE INDEX idx_promo_codes_created_by ON promo_codes(created_by);

-- ride_requests — demand + fare quote; scheduled_for makes scheduling a column,
-- not a new table (doc 01 §7.1)
CREATE TABLE ride_requests (
    id                BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id         UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    passenger_id      BIGINT NOT NULL REFERENCES passenger_profiles(user_id) ON DELETE RESTRICT,
    city_id           SMALLINT NOT NULL REFERENCES cities(id) ON DELETE RESTRICT,
    category_id       SMALLINT NOT NULL REFERENCES vehicle_categories(id) ON DELETE RESTRICT,
    pickup_lat        NUMERIC(9,6) NOT NULL,
    pickup_lng        NUMERIC(9,6) NOT NULL,
    pickup_address    VARCHAR(255),
    pickup_zone_id    BIGINT REFERENCES zones(id) ON DELETE SET NULL,
    dropoff_lat       NUMERIC(9,6) NOT NULL,
    dropoff_lng       NUMERIC(9,6) NOT NULL,
    dropoff_address   VARCHAR(255),
    est_distance_km   NUMERIC(8,2),
    est_duration_min  SMALLINT,
    est_fare          NUMERIC(12,2) NOT NULL,
    surge_multiplier  NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    payment_intent    payment_channel NOT NULL,
    promo_code_id     BIGINT REFERENCES promo_codes(id) ON DELETE SET NULL,
    women_only        BOOLEAN NOT NULL DEFAULT false,
    scheduled_for     TIMESTAMPTZ,
    status            ride_request_status NOT NULL DEFAULT 'pending',
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ,
    cancelled_at      TIMESTAMPTZ,
    CONSTRAINT chk_ride_requests_est_fare_nonneg CHECK (est_fare >= 0)
);

CREATE INDEX idx_ride_requests_passenger ON ride_requests(passenger_id);
CREATE INDEX idx_ride_requests_category ON ride_requests(category_id);
CREATE INDEX idx_ride_requests_pickup_zone ON ride_requests(pickup_zone_id);
CREATE INDEX idx_ride_requests_promo_code ON ride_requests(promo_code_id);
-- the dispatcher's work queue; completed requests never bloat it (doc 03 §5)
CREATE INDEX idx_requests_open ON ride_requests (city_id, requested_at)
    WHERE status IN ('pending', 'searching');

-- belt and suspenders (doc 03 §8 T1 pattern): a passenger can have at most
-- one open IMMEDIATE request at a time. The service checks this too, but a
-- double submit racing two inserts is only actually impossible because of
-- this constraint — same idiom as ux_payment_one_success.
-- scheduled_for IS NULL scopes this to "ride now" requests only: a
-- scheduled request has no dispatch/expiry semantics yet (see
-- rides.service.js's createRequest) and must not block booking an
-- immediate ride today just because a future one is already on the books.
CREATE UNIQUE INDEX ux_one_active_request_per_passenger ON ride_requests (passenger_id)
    WHERE status IN ('pending', 'searching') AND scheduled_for IS NULL;

-- ride_offers — associative entity resolving drivers<->requests M:N; the data
-- behind acceptance rates (doc 01 §13.4)
CREATE TABLE ride_offers (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    request_id          BIGINT NOT NULL REFERENCES ride_requests(id) ON DELETE CASCADE,
    driver_id           BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE CASCADE,
    round               SMALLINT NOT NULL DEFAULT 1,
    driver_distance_km  NUMERIC(8,2),
    response            offer_response NOT NULL DEFAULT 'pending',
    offered_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    responded_at        TIMESTAMPTZ,
    CONSTRAINT uq_ride_offers_request_driver UNIQUE (request_id, driver_id)
);

CREATE INDEX idx_ride_offers_driver ON ride_offers(driver_id);

-- trips — the fulfilled ride; immutable fare breakdown snapshot (doc 01 §13.3)
CREATE TABLE trips (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_code           VARCHAR(20) NOT NULL UNIQUE
        DEFAULT 'JT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_trip_code')::text, 6, '0'),
    request_id          BIGINT NOT NULL UNIQUE REFERENCES ride_requests(id) ON DELETE RESTRICT,
    passenger_id        BIGINT NOT NULL REFERENCES passenger_profiles(user_id) ON DELETE RESTRICT,
    driver_id           BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE RESTRICT,
    vehicle_id          BIGINT NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
    status              trip_status NOT NULL DEFAULT 'assigned',
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    arrived_at          TIMESTAMPTZ,
    started_at          TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    actual_distance_km  NUMERIC(8,2),
    actual_duration_min INT,
    base_fare           NUMERIC(12,2) NOT NULL DEFAULT 0,
    distance_fare       NUMERIC(12,2) NOT NULL DEFAULT 0,
    time_fare            NUMERIC(12,2) NOT NULL DEFAULT 0,
    waiting_fare         NUMERIC(12,2) NOT NULL DEFAULT 0,
    surge_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
    booking_fee          NUMERIC(12,2) NOT NULL DEFAULT 0,
    discount_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_fare           NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency             CHAR(3) NOT NULL DEFAULT 'BDT',
    payment_status       trip_payment_status NOT NULL DEFAULT 'unpaid',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_trips_total_fare_nonneg CHECK (total_fare >= 0),
    CONSTRAINT chk_fare_identity CHECK (
        total_fare = base_fare + distance_fare + time_fare + waiting_fare
                   + surge_amount + booking_fee - discount_amount
    ),
    CONSTRAINT chk_trip_timeline CHECK (
        (arrived_at IS NULL OR arrived_at >= assigned_at) AND
        (started_at IS NULL OR arrived_at IS NULL OR started_at >= arrived_at) AND
        (completed_at IS NULL OR started_at IS NULL OR completed_at >= started_at)
    )
);

CREATE INDEX idx_trips_vehicle ON trips(vehicle_id);
-- ride-history screens, newest first; index order matches ORDER BY (doc 03 §5)
CREATE INDEX idx_trips_driver ON trips (driver_id, created_at DESC);
CREATE INDEX idx_trips_passenger ON trips (passenger_id, created_at DESC);

-- trip_stops — weak entity; multi-stop rides
CREATE TABLE trip_stops (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id      BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    stop_order   SMALLINT NOT NULL,
    lat          NUMERIC(9,6) NOT NULL,
    lng          NUMERIC(9,6) NOT NULL,
    address_text VARCHAR(255),
    arrived_at   TIMESTAMPTZ,
    CONSTRAINT uq_trip_stops_trip_order UNIQUE (trip_id, stop_order)
);

-- trip_status_history — weak, append-only audit of every state change
CREATE TABLE trip_status_history (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id     BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    from_status trip_status,
    to_status   trip_status NOT NULL,
    changed_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    note        VARCHAR(255),
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_status_history_trip ON trip_status_history(trip_id);
CREATE INDEX idx_trip_status_history_changed_by ON trip_status_history(changed_by);

-- trip_location_pings — high-volume GPS breadcrumb trail (~1 row/4s).
-- Partitioned by month (doc 03 §10); PK includes the partition key; BIGSERIAL
-- because identity columns on partitioned tables only arrived in PG17.
CREATE TABLE trip_location_pings (
    id          BIGSERIAL,
    trip_id     BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    lat         NUMERIC(9,6) NOT NULL,
    lng         NUMERIC(9,6) NOT NULL,
    speed_kmh   NUMERIC(5,2),
    heading     NUMERIC(5,2),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (id, recorded_at)
) PARTITION BY RANGE (recorded_at);

CREATE INDEX idx_trip_location_pings_trip ON trip_location_pings(trip_id);

-- monthly children + a DEFAULT partition (doc 03 §10); add the next month's
-- partition via a scheduled job (jobs/) before it is needed.
CREATE TABLE trip_location_pings_2026_07 PARTITION OF trip_location_pings
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE trip_location_pings_2026_08 PARTITION OF trip_location_pings
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE trip_location_pings_default PARTITION OF trip_location_pings DEFAULT;

-- trip_cancellations — weak 1:1; avoids NULL-polluting every completed trip
CREATE TABLE trip_cancellations (
    trip_id           BIGINT PRIMARY KEY REFERENCES trips(id) ON DELETE CASCADE,
    cancelled_by_role cancelled_by_role NOT NULL,
    cancelled_by      BIGINT REFERENCES users(id) ON DELETE SET NULL,
    reason_code       cancellation_reason_code NOT NULL,
    reason_text       VARCHAR(255),
    fee_charged       NUMERIC(12,2) NOT NULL DEFAULT 0,
    cancelled_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_cancellations_cancelled_by ON trip_cancellations(cancelled_by);

-- trip_messages — in-ride chat, retained for safety investigations
CREATE TABLE trip_messages (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id      BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    sender_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message_type trip_message_type NOT NULL DEFAULT 'text',
    body         TEXT,
    sent_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at      TIMESTAMPTZ
);

CREATE INDEX idx_trip_messages_trip ON trip_messages(trip_id);
CREATE INDEX idx_trip_messages_sender ON trip_messages(sender_id);


-- =============================================================================
-- 6. DOMAIN 5 — PAYMENTS, WALLET & SETTLEMENT
-- payments records attempts, not just successes; wallet_transactions is an
-- append-only ledger; rates are referenced, amounts are snapshotted (doc 01 §8).
-- =============================================================================

-- payment_methods — saved instruments; only gateway tokens, never raw numbers
CREATE TABLE payment_methods (
    id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method_type    payment_instrument_type NOT NULL,
    provider       payment_instrument_provider NOT NULL,
    display_label  VARCHAR(60),
    gateway_token  VARCHAR(255) NOT NULL,
    is_default     BOOLEAN NOT NULL DEFAULT false,
    is_verified    BOOLEAN NOT NULL DEFAULT false,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at     TIMESTAMPTZ
);

CREATE INDEX idx_payment_methods_user ON payment_methods(user_id);

-- payments — every money-in attempt: trip payments and wallet top-ups
CREATE TABLE payments (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    purpose            payment_purpose NOT NULL,
    trip_id            BIGINT REFERENCES trips(id) ON DELETE RESTRICT,
    payer_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    payment_method_id  BIGINT REFERENCES payment_methods(id) ON DELETE SET NULL,
    method_type        payment_channel NOT NULL,
    gateway            payment_gateway NOT NULL DEFAULT 'none',
    gateway_txn_id     VARCHAR(120) UNIQUE,
    amount             NUMERIC(12,2) NOT NULL,
    currency           CHAR(3) NOT NULL DEFAULT 'BDT',
    status             payment_status NOT NULL DEFAULT 'initiated',
    failure_reason     VARCHAR(255),
    refund_amount      NUMERIC(12,2),
    initiated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at       TIMESTAMPTZ,
    refunded_at        TIMESTAMPTZ,
    CONSTRAINT chk_payments_amount_positive CHECK (amount > 0),
    CONSTRAINT chk_payments_purpose_trip_link CHECK ((purpose = 'trip') = (trip_id IS NOT NULL))
);

CREATE INDEX idx_payments_payer ON payments(payer_id);
CREATE INDEX idx_payments_payment_method ON payments(payment_method_id);
-- at most one successful payment per trip — the constraint IS the business rule (doc 03 §4)
CREATE UNIQUE INDEX ux_payment_one_success ON payments (trip_id)
    WHERE status = 'succeeded' AND purpose = 'trip';

-- wallets — one per user; balance is a cache of the ledger (doc 02 §9)
CREATE TABLE wallets (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    balance    NUMERIC(12,2) NOT NULL DEFAULT 0,
    currency   CHAR(3) NOT NULL DEFAULT 'BDT',
    status     wallet_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- wallet_transactions — append-only ledger; the auditable truth of every balance
CREATE TABLE wallet_transactions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    wallet_id       BIGINT NOT NULL REFERENCES wallets(id) ON DELETE RESTRICT,
    txn_type        wallet_txn_type NOT NULL,
    direction       wallet_txn_direction NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    balance_after   NUMERIC(12,2) NOT NULL,
    reference_type  wallet_txn_reference_type NOT NULL,
    reference_id    BIGINT,
    idempotency_key VARCHAR(120) NOT NULL UNIQUE,
    note            VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_wallet_txn_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);

-- promo_redemptions — associative; usage limits enforced by counting these rows
CREATE TABLE promo_redemptions (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    promo_code_id    BIGINT NOT NULL REFERENCES promo_codes(id) ON DELETE RESTRICT,
    user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    trip_id          BIGINT NOT NULL UNIQUE REFERENCES trips(id) ON DELETE RESTRICT,
    discount_amount  NUMERIC(12,2) NOT NULL,
    redeemed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_promo_redemptions_promo_user_trip UNIQUE (promo_code_id, user_id, trip_id)
);

-- counting a user's redemptions to enforce usage_limit_per_user (doc 03 §5)
CREATE INDEX idx_redemptions_promo_user ON promo_redemptions (promo_code_id, user_id);

-- receipts — passenger-facing numbered financial document
CREATE TABLE receipts (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    receipt_no  VARCHAR(30) NOT NULL UNIQUE
        DEFAULT 'JTR-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_receipt_no')::text, 6, '0'),
    trip_id     BIGINT NOT NULL UNIQUE REFERENCES trips(id) ON DELETE RESTRICT,
    issued_to   BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    subtotal    NUMERIC(12,2) NOT NULL,
    discount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    total       NUMERIC(12,2) NOT NULL,
    pdf_url     TEXT,
    issued_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_receipts_identity CHECK (total = subtotal - discount)
);

CREATE INDEX idx_receipts_issued_to ON receipts(issued_to);

-- invoices — weekly settlement statement grouping a driver's earnings
CREATE TABLE invoices (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    invoice_no      VARCHAR(40) NOT NULL UNIQUE
        DEFAULT 'INV-' || to_char(now(), 'YYYY') || '-W' || lpad(to_char(now(), 'IW'), 2, '0')
                       || '-D' || lpad(nextval('seq_invoice_no')::text, 4, '0'),
    driver_id       BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE RESTRICT,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    trips_count     INT NOT NULL DEFAULT 0,
    total_gross     NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_commission NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_net       NUMERIC(12,2) NOT NULL DEFAULT 0,
    status          invoice_status NOT NULL DEFAULT 'draft',
    pdf_url         TEXT,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invoices_driver_period UNIQUE (driver_id, period_start, period_end)
);

-- driver_earnings — per-trip split of fare into platform cut + driver income
CREATE TABLE driver_earnings (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id             BIGINT NOT NULL UNIQUE REFERENCES trips(id) ON DELETE RESTRICT,
    driver_id           BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE RESTRICT,
    gross_fare          NUMERIC(12,2) NOT NULL,
    commission_rule_id  BIGINT NOT NULL REFERENCES commission_rules(id) ON DELETE RESTRICT,
    commission_pct      NUMERIC(5,2) NOT NULL,
    commission_amount   NUMERIC(12,2) NOT NULL,
    net_earning         NUMERIC(12,2) NOT NULL,
    settlement_status   settlement_status NOT NULL DEFAULT 'pending',
    invoice_id          BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
    earned_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    settled_at          TIMESTAMPTZ,
    CONSTRAINT chk_driver_earnings_identity CHECK (net_earning = gross_fare - commission_amount)
);

CREATE INDEX idx_driver_earnings_driver ON driver_earnings(driver_id);
CREATE INDEX idx_driver_earnings_commission_rule ON driver_earnings(commission_rule_id);
CREATE INDEX idx_driver_earnings_invoice ON driver_earnings(invoice_id);

-- driver_payout_accounts — bKash/Nagad/bank destinations; numbers stored masked
CREATE TABLE driver_payout_accounts (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    driver_id          BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE CASCADE,
    account_type       payout_account_type NOT NULL,
    account_name       VARCHAR(120) NOT NULL,
    account_no_masked  VARCHAR(30) NOT NULL,
    bank_name          VARCHAR(80),
    is_default         BOOLEAN NOT NULL DEFAULT false,
    is_verified        BOOLEAN NOT NULL DEFAULT false,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_driver_payout_accounts_driver ON driver_payout_accounts(driver_id);

-- withdrawals — driver cash-out request with an approval workflow
CREATE TABLE withdrawals (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    public_id          UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    driver_id          BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE RESTRICT,
    payout_account_id  BIGINT NOT NULL REFERENCES driver_payout_accounts(id) ON DELETE RESTRICT,
    amount             NUMERIC(12,2) NOT NULL,
    fee                NUMERIC(12,2) NOT NULL DEFAULT 0,
    status             withdrawal_status NOT NULL DEFAULT 'requested',
    gateway_ref        VARCHAR(120),
    processed_by       BIGINT REFERENCES users(id) ON DELETE SET NULL,
    rejection_reason   VARCHAR(255),
    requested_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    processed_at       TIMESTAMPTZ,
    CONSTRAINT chk_withdrawals_amount_positive CHECK (amount > 0)
);

CREATE INDEX idx_withdrawals_driver ON withdrawals(driver_id);
CREATE INDEX idx_withdrawals_payout_account ON withdrawals(payout_account_id);
CREATE INDEX idx_withdrawals_processed_by ON withdrawals(processed_by);


-- =============================================================================
-- 7. DOMAIN 6 — ENGAGEMENT & SAFETY
-- =============================================================================

-- ratings — bidirectional; review is just the optional comment (doc 01 §9)
CREATE TABLE ratings (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id    BIGINT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    rater_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    ratee_id   BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rater_role rater_role NOT NULL,
    score      SMALLINT NOT NULL,
    comment    TEXT,
    tags       JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ratings_trip_rater UNIQUE (trip_id, rater_id),
    CONSTRAINT chk_ratings_score_range CHECK (score BETWEEN 1 AND 5),
    CONSTRAINT chk_ratings_no_self_rating CHECK (rater_id <> ratee_id)
);

CREATE INDEX idx_ratings_ratee ON ratings(ratee_id);

-- favorite_drivers — resolves passengers<->drivers M:N
CREATE TABLE favorite_drivers (
    passenger_id BIGINT NOT NULL REFERENCES passenger_profiles(user_id) ON DELETE CASCADE,
    driver_id    BIGINT NOT NULL REFERENCES driver_profiles(user_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (passenger_id, driver_id)
);

CREATE INDEX idx_favorite_drivers_driver ON favorite_drivers(driver_id);

-- referrals — growth loop; reward unlocks on referee's first completed trip
CREATE TABLE referrals (
    id                  BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    referrer_id         BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    referee_id          BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
    code_used           VARCHAR(20) NOT NULL,
    status              referral_status NOT NULL DEFAULT 'pending',
    qualifying_trip_id  BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    referrer_bonus      NUMERIC(12,2),
    referee_bonus       NUMERIC(12,2),
    rewarded_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX idx_referrals_qualifying_trip ON referrals(qualifying_trip_id);

-- emergency_contacts — SOS notification fan-out targets
CREATE TABLE emergency_contacts (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name         VARCHAR(120) NOT NULL,
    phone        VARCHAR(20) NOT NULL,
    relationship VARCHAR(40),
    priority     SMALLINT NOT NULL DEFAULT 1,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_emergency_contacts_user_phone UNIQUE (user_id, phone)
);

-- sos_alerts — panic-button events; location frozen at trigger time
CREATE TABLE sos_alerts (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    trip_id          BIGINT REFERENCES trips(id) ON DELETE RESTRICT,
    triggered_by     BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    lat              NUMERIC(9,6) NOT NULL,
    lng              NUMERIC(9,6) NOT NULL,
    status           sos_status NOT NULL DEFAULT 'active',
    acknowledged_by  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    triggered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at      TIMESTAMPTZ,
    resolution_note  VARCHAR(255)
);

CREATE INDEX idx_sos_alerts_trip ON sos_alerts(trip_id);
CREATE INDEX idx_sos_alerts_triggered_by ON sos_alerts(triggered_by);
CREATE INDEX idx_sos_alerts_acknowledged_by ON sos_alerts(acknowledged_by);

-- notifications — multi-channel outbox + in-app inbox; high volume
CREATE TABLE notifications (
    id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   notification_category NOT NULL,
    title      VARCHAR(120) NOT NULL,
    body       TEXT,
    payload    JSONB,
    channel    notification_channel NOT NULL DEFAULT 'in_app',
    read_at    TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- the badge count; reading a notification removes it from the index (doc 03 §5)
CREATE INDEX idx_notifications_unread ON notifications (user_id, created_at DESC)
    WHERE read_at IS NULL;

-- user_reports — "report this driver/passenger" moderation queue
CREATE TABLE user_reports (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporter_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reported_id  BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    trip_id      BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    category     report_category NOT NULL,
    description  TEXT,
    status       report_status NOT NULL DEFAULT 'open',
    handled_by   BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    CONSTRAINT chk_user_reports_no_self_report CHECK (reporter_id <> reported_id)
);

CREATE INDEX idx_user_reports_reported ON user_reports(reported_id);
CREATE INDEX idx_user_reports_trip ON user_reports(trip_id);
CREATE INDEX idx_user_reports_handled_by ON user_reports(handled_by);


-- =============================================================================
-- 8. DOMAIN 7 — SUPPORT & GOVERNANCE
-- =============================================================================

-- support_tickets — helpdesk case with assignment + SLA fields
CREATE TABLE support_tickets (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_no    VARCHAR(30) NOT NULL UNIQUE
        DEFAULT 'TKT-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_ticket_no')::text, 5, '0'),
    user_id      BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    trip_id      BIGINT REFERENCES trips(id) ON DELETE SET NULL,
    category     ticket_category NOT NULL,
    subject      VARCHAR(150) NOT NULL,
    description  TEXT,
    status       ticket_status NOT NULL DEFAULT 'open',
    priority     ticket_priority NOT NULL DEFAULT 'medium',
    assigned_to  BIGINT REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at  TIMESTAMPTZ,
    closed_at    TIMESTAMPTZ
);

CREATE INDEX idx_support_tickets_user ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_trip ON support_tickets(trip_id);
CREATE INDEX idx_support_tickets_assigned_to ON support_tickets(assigned_to);

-- support_ticket_messages — weak entity; the opening description is message #1
CREATE TABLE support_ticket_messages (
    id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    ticket_id        BIGINT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    body             TEXT NOT NULL,
    attachment_url   TEXT,
    is_internal_note BOOLEAN NOT NULL DEFAULT false,
    sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_ticket_messages_ticket ON support_ticket_messages(ticket_id);
CREATE INDEX idx_support_ticket_messages_sender ON support_ticket_messages(sender_id);

-- disputes — formal fare/payment contest; terminal states are explicit
CREATE TABLE disputes (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    dispute_no         VARCHAR(30) NOT NULL UNIQUE
        DEFAULT 'DSP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('seq_dispute_no')::text, 5, '0'),
    trip_id            BIGINT NOT NULL REFERENCES trips(id) ON DELETE RESTRICT,
    raised_by          BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    dispute_type       dispute_type NOT NULL,
    description        TEXT,
    disputed_amount    NUMERIC(12,2),
    status             dispute_status NOT NULL DEFAULT 'open',
    resolution_note    TEXT,
    resolved_by        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    refund_payment_id  BIGINT REFERENCES payments(id) ON DELETE SET NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at        TIMESTAMPTZ
);

CREATE INDEX idx_disputes_trip ON disputes(trip_id);
CREATE INDEX idx_disputes_raised_by ON disputes(raised_by);
CREATE INDEX idx_disputes_resolved_by ON disputes(resolved_by);
CREATE INDEX idx_disputes_refund_payment ON disputes(refund_payment_id);

-- audit_logs — append-only, before/after JSON snapshots; actor_role is
-- deliberately denormalized (describes the actor AS THEY WERE, doc 02 §9)
--
-- actor_id is RESTRICT, not SET NULL: this table is unconditionally
-- immutable (fn_block_mutation below blocks every UPDATE, no exceptions) —
-- including the UPDATE that ON DELETE SET NULL would need to run to null
-- this column out when a user row is deleted. SET NULL here would make
-- "delete a user who has ever performed an audited action" fail with a
-- confusing "audit_logs is append-only" error instead of a clear one.
-- RESTRICT says the true thing directly: you cannot delete that user,
-- full stop — an audit trail should never let its actor silently vanish.
CREATE TABLE audit_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id    BIGINT REFERENCES users(id) ON DELETE RESTRICT,
    actor_role  VARCHAR(20),
    action      VARCHAR(80) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id   BIGINT,
    old_value   JSONB,
    new_value   JSONB,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);


-- =============================================================================
-- 9. FUNCTIONS & TRIGGERS (doc 03 §7)
-- =============================================================================

-- 1. fn_touch_updated_at — stamp updated_at on every UPDATE (×7 tables)
CREATE FUNCTION fn_touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON passenger_profiles
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON driver_availability
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();
CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION fn_touch_updated_at();

-- 2. fn_create_user_wallet — new user => wallet row (total 1:1 participation)
CREATE FUNCTION fn_create_user_wallet() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO wallets (user_id, balance, currency, status)
    VALUES (NEW.id, 0, 'BDT', 'active');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_user_wallet AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION fn_create_user_wallet();

-- 3. fn_create_driver_availability — new driver => availability row
CREATE FUNCTION fn_create_driver_availability() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO driver_availability (driver_id, status)
    VALUES (NEW.user_id, 'offline');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_driver_availability AFTER INSERT ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION fn_create_driver_availability();

-- 4. fn_log_trip_status — INSERT/UPDATE on trips => history row.
-- Reads the app.user_id session variable set by the backend inside the same
-- transaction (doc 03 §7 "session-variable trick") so history rows carry the
-- human who caused the change, not just "the system."
CREATE FUNCTION fn_log_trip_status() RETURNS TRIGGER AS $$
DECLARE
    v_from   trip_status;
    v_actor  BIGINT;
BEGIN
    v_actor := NULLIF(current_setting('app.user_id', true), '')::BIGINT;

    IF TG_OP = 'INSERT' THEN
        v_from := NULL;
        INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by)
        VALUES (NEW.id, v_from, NEW.status, v_actor);
    ELSIF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO trip_status_history (trip_id, from_status, to_status, changed_by)
        VALUES (NEW.id, OLD.status, NEW.status, v_actor);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_trip_status_insert AFTER INSERT ON trips
    FOR EACH ROW EXECUTE FUNCTION fn_log_trip_status();
CREATE TRIGGER trg_log_trip_status_update AFTER UPDATE ON trips
    FOR EACH ROW EXECUTE FUNCTION fn_log_trip_status();

-- 5. fn_apply_wallet_txn — ledger insert => lock wallet, compute + stamp
-- balance_after, update the cached balance, atomically. Runs BEFORE INSERT so
-- balance_after can be set on the row being inserted without a second UPDATE
-- against the (append-only) ledger table.
CREATE FUNCTION fn_apply_wallet_txn() RETURNS TRIGGER AS $$
DECLARE
    v_balance NUMERIC(12,2);
BEGIN
    SELECT balance INTO v_balance FROM wallets WHERE id = NEW.wallet_id FOR UPDATE;

    IF NEW.direction = 'credit' THEN
        v_balance := v_balance + NEW.amount;
    ELSE
        v_balance := v_balance - NEW.amount;
    END IF;

    NEW.balance_after := v_balance;

    UPDATE wallets SET balance = v_balance, updated_at = now() WHERE id = NEW.wallet_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_wallet_txn BEFORE INSERT ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_apply_wallet_txn();

-- 6. fn_block_mutation — reject UPDATE/DELETE on ledger, audit log, status
-- history: append-only BY MECHANISM, not by promise (doc 01 §13.8, doc 03 §12)
CREATE FUNCTION fn_block_mutation() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_block_update_wallet_transactions BEFORE UPDATE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
CREATE TRIGGER trg_block_delete_wallet_transactions BEFORE DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
CREATE TRIGGER trg_block_update_audit_logs BEFORE UPDATE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
CREATE TRIGGER trg_block_delete_audit_logs BEFORE DELETE ON audit_logs
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
CREATE TRIGGER trg_block_update_trip_status_history BEFORE UPDATE ON trip_status_history
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();
CREATE TRIGGER trg_block_delete_trip_status_history BEFORE DELETE ON trip_status_history
    FOR EACH ROW EXECUTE FUNCTION fn_block_mutation();

-- 7. fn_apply_rating — rating insert => update the ratee's profile aggregate
-- (the registered denormalization, doc 02 §9), O(1) incremental formula
CREATE FUNCTION fn_apply_rating() RETURNS TRIGGER AS $$
BEGIN
    IF NEW.rater_role = 'passenger' THEN
        -- passenger rated the driver
        UPDATE driver_profiles
        SET rating_avg = ((rating_avg * rating_count) + NEW.score) / (rating_count + 1),
            rating_count = rating_count + 1
        WHERE user_id = NEW.ratee_id;
    ELSE
        -- driver rated the passenger
        UPDATE passenger_profiles
        SET rating_avg = ((rating_avg * rating_count) + NEW.score) / (rating_count + 1),
            rating_count = rating_count + 1
        WHERE user_id = NEW.ratee_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_apply_rating AFTER INSERT ON ratings
    FOR EACH ROW EXECUTE FUNCTION fn_apply_rating();

-- 8. fn_current_pricing — one canonical implementation of "which tariff
-- applies?" (effective-dated lookup, doc 01 §13.7)
-- RETURNS SETOF, not a bare pricing_rules: a plain composite return always
-- yields exactly one row from a FROM-clause call — an all-NULL row when
-- nothing matches, never zero rows. SETOF makes "no tariff for this
-- market" come back as zero rows, like every other lookup in this schema.
CREATE FUNCTION fn_current_pricing(p_city_id SMALLINT, p_category_id SMALLINT, p_at TIMESTAMPTZ DEFAULT now())
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

-- 9. fn_wallet_balance_audit — recompute a wallet's balance from the ledger;
-- if it ever disagrees with wallets.balance, you found a bug (doc 03 §7, §11)
CREATE FUNCTION fn_wallet_balance_audit(p_wallet_id BIGINT) RETURNS NUMERIC AS $$
    SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount ELSE -amount END), 0)
    FROM wallet_transactions
    WHERE wallet_id = p_wallet_id;
$$ LANGUAGE sql STABLE;

-- 10. fn_current_commission — same "which rule applies?" shape as
-- fn_current_pricing, plus the one thing commission_rules adds: city_id
-- NULL means countrywide (uq_commission_rules_identity's NULLS NOT
-- DISTINCT comment above). A city-specific rule must win over a
-- countrywide one when both exist, so city_id NULLS LAST ranks the
-- specific match first; effective_from DESC then picks the latest within
-- whichever tier matched.
CREATE FUNCTION fn_current_commission(p_category_id SMALLINT, p_city_id SMALLINT, p_at TIMESTAMPTZ DEFAULT now())
RETURNS SETOF commission_rules AS $$
    SELECT *
    FROM commission_rules
    WHERE category_id = p_category_id
      AND (city_id = p_city_id OR city_id IS NULL)
      AND effective_from <= p_at
      AND (effective_to IS NULL OR effective_to > p_at)
    ORDER BY city_id NULLS LAST, effective_from DESC
    LIMIT 1;
$$ LANGUAGE sql STABLE;


-- =============================================================================
-- 10. VIEWS (doc 03 §6)
-- =============================================================================

-- "who can I dispatch right now?" — approved + online + active vehicle
CREATE VIEW v_active_drivers AS
SELECT
    dp.user_id            AS driver_id,
    u.full_name           AS driver_name,
    u.phone                AS driver_phone,
    da.status              AS availability_status,
    da.current_lat,
    da.current_lng,
    da.current_zone_id,
    da.last_ping_at,
    v.id                   AS vehicle_id,
    v.category_id,
    v.registration_no
FROM driver_profiles dp
JOIN users u               ON u.id = dp.user_id
JOIN driver_availability da ON da.driver_id = dp.user_id
JOIN vehicles v             ON v.id = dp.active_vehicle_id
WHERE dp.verification_status = 'approved'
  AND da.status = 'online'
  AND v.verification_status = 'approved';

-- "show me this trip like a human would describe it"
CREATE VIEW v_trip_details AS
SELECT
    t.id                AS trip_id,
    t.trip_code,
    t.status,
    pu.full_name        AS passenger_name,
    pu.phone            AS passenger_phone,
    du.full_name        AS driver_name,
    du.phone            AS driver_phone,
    v.registration_no   AS vehicle_registration_no,
    rr.pickup_address,
    rr.dropoff_address,
    t.total_fare,
    t.currency,
    t.payment_status,
    t.assigned_at,
    t.completed_at
FROM trips t
JOIN ride_requests rr ON rr.id = t.request_id
JOIN users pu          ON pu.id = t.passenger_id
JOIN users du           ON du.id = t.driver_id
JOIN vehicles v          ON v.id = t.vehicle_id;

-- driver app's earnings tab: trips/gross/commission/net per day
CREATE VIEW v_driver_daily_earnings AS
SELECT
    driver_id,
    date_trunc('day', earned_at)::date AS earning_date,
    COUNT(*)                            AS trips_count,
    SUM(gross_fare)                     AS gross_total,
    SUM(commission_amount)              AS commission_total,
    SUM(net_earning)                    AS net_total
FROM driver_earnings
GROUP BY driver_id, date_trunc('day', earned_at);

-- admin headline chart: completed trips, gross and platform revenue per city per month
CREATE VIEW v_city_monthly_revenue AS
SELECT
    rr.city_id,
    date_trunc('month', t.completed_at)::date AS revenue_month,
    COUNT(*)                                  AS completed_trips,
    SUM(t.total_fare)                         AS gross_revenue,
    SUM(de.commission_amount)                 AS platform_revenue
FROM trips t
JOIN ride_requests rr   ON rr.id = t.request_id
JOIN driver_earnings de ON de.trip_id = t.id
WHERE t.status = 'completed'
GROUP BY rr.city_id, date_trunc('month', t.completed_at);
