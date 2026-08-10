// Loaded via `node --import` before any test file, so env.js (which reads
// process.env at import time) sees NODE_ENV=test — see rateLimit.js for why
// that matters.
process.env.NODE_ENV = 'test';
// Tests must be reproducible even when a contributor's existing local .env
// predates M2. Development/production still fail loudly without a real secret.
process.env.JWT_SECRET ??= 'test-only-jwt-secret-that-is-at-least-32-characters';
