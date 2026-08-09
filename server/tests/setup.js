// Loaded via `node --import` before any test file, so env.js (which reads
// process.env at import time) sees NODE_ENV=test — see rateLimit.js for why
// that matters.
process.env.NODE_ENV = 'test';
