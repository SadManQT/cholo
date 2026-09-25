process.env.NODE_ENV = 'test';
// Most ride tests drive trips without GPS; tests/api/arrival-radius.test.js turns the check on.
process.env.ARRIVAL_RADIUS_METERS ??= '0';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-at-least-32-characters';
