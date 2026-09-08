import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDirectory, '../../../.env');

dotenv.config({ path: rootEnvPath, quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').url('DATABASE_URL must be a valid URL'),
  CLIENT_ORIGIN: z.string().url('CLIENT_ORIGIN must be a valid URL').default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  // Geo abstraction (doc 05-06-07 §8): one interface, swappable provider.
  // 'osm' and 'photon' are implemented — 'google' is the documented future
  // paid adapter, for whenever OSM-based coverage stops being enough.
  GEO_PROVIDER: z.enum(['osm', 'photon', 'google']).default('photon'),
  OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  PHOTON_BASE_URL: z.string().url().default('https://photon.komoot.io'),

  // Payment gateway abstraction (doc 05-06-07 §8's adapter pattern, applied
  // to doc 09 §7/§10.4's gateway sandbox): one interface, swappable
  // provider. Only 'sslcommerz' is implemented. store_id/store_passwd
  // default to SSLCommerz's own PUBLISHED universal sandbox credentials
  // (developer.sslcommerz.com) — not a secret, safe to default, works
  // with zero signup. Override with your own sandbox store if you want
  // transactions isolated from everyone else using the shared testbox.
  PAYMENT_GATEWAY: z.enum(['sslcommerz']).default('sslcommerz'),
  SSLCOMMERZ_BASE_URL: z.string().url().default('https://sandbox.sslcommerz.com'),
  SSLCOMMERZ_STORE_ID: z.string().default('testbox'),
  SSLCOMMERZ_STORE_PASSWORD: z.string().default('qwerty'),
  // Where SSLCommerz's server sends the IPN webhook — must be a publicly
  // reachable URL (a tunnel like ngrok in dev; the real API origin in
  // prod), never localhost, or their servers can't reach it at all.
  PUBLIC_API_ORIGIN: z.string().url().default('http://localhost:3000'),
});

function formatIssues(issues) {
  return issues
    .map((issue) => `  - ${issue.path.join('.') || 'environment'}: ${issue.message}`)
    .join('\n');
}

function loadEnvironment(source) {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    throw new Error(`Invalid environment configuration:\n${formatIssues(result.error.issues)}`);
  }

  return Object.freeze(result.data);
}

export const env = loadEnvironment(process.env);
