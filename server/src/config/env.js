import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import { z } from 'zod';

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDirectory, '../../../.env');

dotenv.config({ path: rootEnvPath, quiet: true });

const emptyToUndefined = (value) => (value === '' ? undefined : value);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65_535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').url('DATABASE_URL must be a valid URL'),
  // One or more comma-separated client URLs (e.g. production + a custom domain). The first is used for redirects.
  CLIENT_ORIGIN: z.string().default('http://localhost:5173')
    .transform((value) => value.split(',').map((origin) => origin.trim().replace(/\/$/, '')).filter(Boolean))
    .pipe(z.array(z.string().url('CLIENT_ORIGIN must be a valid URL (comma-separate several)')).min(1)),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  GEO_PROVIDER: z.enum(['osm', 'photon', 'google']).default('photon'),
  OSRM_BASE_URL: z.string().url().default('https://router.project-osrm.org'),
  NOMINATIM_BASE_URL: z.string().url().default('https://nominatim.openstreetmap.org'),
  PHOTON_BASE_URL: z.string().url().default('https://photon.komoot.io'),
  // Only for your own routing/geocoding servers: sent as "Authorization: Bearer …" so they can reject
  // everyone else. Leave unset with the public servers, or the token would leak to them.
  GEO_UPSTREAM_TOKEN: z.preprocess(emptyToUndefined, z.string().min(16).optional()),

  PAYMENT_GATEWAY: z.enum(['sslcommerz']).default('sslcommerz'),
  SSLCOMMERZ_BASE_URL: z.string().url().default('https://sandbox.sslcommerz.com'),
  SSLCOMMERZ_STORE_ID: z.string().default('testbox'),
  SSLCOMMERZ_STORE_PASSWORD: z.string().default('qwerty'),
  PUBLIC_API_ORIGIN: z.string().url().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default(resolve(currentDirectory, '../../uploads')),
  // Hosted Postgres (Supabase) requires TLS; local Docker Postgres does not.
  DATABASE_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  // When set, uploads go to Supabase Storage instead of the local disk (Render's disk is wiped on restart).
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(20).optional()),
  SUPABASE_BUCKET: z.string().default('uploads'),
  // Drivers can only mark arrival, reach a stop or complete a trip within this distance of the place.
  // 0 turns the check off. ponytail: one radius for all three; tune per place type if GPS in dense areas fights it.
  ARRIVAL_RADIUS_METERS: z.coerce.number().int().min(0).max(5_000).default(300),
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
