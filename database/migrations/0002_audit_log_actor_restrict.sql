-- Keep immutable audit rows from being removed through a user cascade.
BEGIN;

ALTER TABLE audit_logs
    DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;

ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE RESTRICT;

COMMIT;
