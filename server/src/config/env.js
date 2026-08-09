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
