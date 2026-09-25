import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

// Two kinds of stored file:
//  - public (profile photos): a permanent URL anyone can open, returned as-is.
//  - private (driver and vehicle documents): stored as "private://documents/<name>" and only ever handed
//    out as a short-lived signed link to /api/v1/uploads/private/<name>, which the API checks and serves.
// Supabase Storage in production (a public bucket plus a private "documents" bucket), local disk in dev.

export const PRIVATE_PREFIX = 'private://documents/';
const PRIVATE_BUCKET = 'documents';
const PRIVATE_DIR = `${env.UPLOAD_DIR}-private`;
const SIGNED_URL_TTL_SECONDS = 10 * 60;
const NAME_PATTERN = /^[A-Za-z0-9_-]+\.(jpg|png|webp|pdf)$/;

const supabaseBase = () => env.SUPABASE_URL?.replace(/\/$/, '');
const usingSupabase = () => Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
const serviceHeaders = () => ({
  authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
});

let privateBucketReady = null;

// Creates the private bucket the first time it's needed; "already exists" is success.
function ensurePrivateBucket() {
  privateBucketReady ??= fetch(`${supabaseBase()}/storage/v1/bucket`, {
    method: 'POST',
    headers: { ...serviceHeaders(), 'content-type': 'application/json' },
    body: JSON.stringify({ id: PRIVATE_BUCKET, name: PRIVATE_BUCKET, public: false }),
  }).then(async (response) => {
    const text = await response.text();
    if (!response.ok && !/already exists|Duplicate/i.test(text)) {
      throw new Error(`Supabase private bucket setup failed: ${response.status} ${text}`);
    }
  }).catch((error) => {
    privateBucketReady = null;
    throw error;
  });
  return privateBucketReady;
}

async function uploadToSupabase(bucket, name, body, contentType) {
  const response = await fetch(`${supabaseBase()}/storage/v1/object/${bucket}/${name}`, {
    method: 'POST',
    headers: { ...serviceHeaders(), 'content-type': contentType, 'cache-control': 'max-age=31536000' },
    body,
  });
  if (!response.ok) {
    throw new Error(`Supabase Storage upload failed: ${response.status} ${await response.text()}`);
  }
}

export async function storeFile(name, body, contentType, { isPrivate = false } = {}) {
  if (isPrivate) {
    if (usingSupabase()) {
      await ensurePrivateBucket();
      await uploadToSupabase(PRIVATE_BUCKET, name, body, contentType);
    } else {
      await mkdir(PRIVATE_DIR, { recursive: true });
      await writeFile(join(PRIVATE_DIR, name), body);
    }
    return `${PRIVATE_PREFIX}${name}`;
  }

  if (usingSupabase()) {
    await uploadToSupabase(env.SUPABASE_BUCKET, name, body, contentType);
    return `${supabaseBase()}/storage/v1/object/public/${env.SUPABASE_BUCKET}/${name}`;
  }

  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await writeFile(join(env.UPLOAD_DIR, name), body);
  return `${env.PUBLIC_API_ORIGIN}/uploads/${name}`;
}

/** Files a document may point at: our private refs, or (older documents) our own public storage. */
export function isOwnFileUrl(value) {
  if (value.startsWith(PRIVATE_PREFIX)) return NAME_PATTERN.test(value.slice(PRIVATE_PREFIX.length));
  const publicPrefixes = [`${env.PUBLIC_API_ORIGIN}/uploads/`];
  if (supabaseBase()) publicPrefixes.push(`${supabaseBase()}/storage/v1/object/public/`);
  return publicPrefixes.some((prefix) => value.startsWith(prefix));
}

const signature = (name, expires) => createHmac('sha256', env.JWT_SECRET)
  .update(`private-file:${name}:${expires}`).digest('base64url');

export function signPrivateUrl(ref) {
  const name = ref.slice(PRIVATE_PREFIX.length);
  const expires = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
  return `${env.PUBLIC_API_ORIGIN}/api/v1/uploads/private/${name}?expires=${expires}&signature=${signature(name, expires)}`;
}

/** Replaces every private ref in a response body with a fresh signed link. */
export function signPrivateRefs(value) {
  if (typeof value === 'string') return value.startsWith(PRIVATE_PREFIX) ? signPrivateUrl(value) : value;
  if (Array.isArray(value)) return value.map(signPrivateRefs);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, signPrivateRefs(entry)]));
  }
  return value;
}

const CONTENT_TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

/** Checks a signed link and returns the file's bytes. */
export async function readPrivateFile(name, { expires, signature: given }) {
  const expiresAt = Number(expires);
  const expected = signature(name, expiresAt);
  const valid = NAME_PATTERN.test(name) && Number.isInteger(expiresAt) && expiresAt * 1000 > Date.now()
    && typeof given === 'string' && given.length === expected.length
    && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
  if (!valid) throw new AppError(403, 'FILE_LINK_EXPIRED');

  const contentType = CONTENT_TYPES[name.split('.').pop()];
  if (usingSupabase()) {
    const response = await fetch(`${supabaseBase()}/storage/v1/object/${PRIVATE_BUCKET}/${name}`, { headers: serviceHeaders() });
    if (response.status === 404 || response.status === 400) throw new AppError(404, 'FILE_NOT_FOUND');
    if (!response.ok) throw new Error(`Supabase Storage download failed: ${response.status}`);
    return { body: Buffer.from(await response.arrayBuffer()), contentType };
  }
  try {
    return { body: await readFile(join(PRIVATE_DIR, name)), contentType };
  } catch {
    throw new AppError(404, 'FILE_NOT_FOUND');
  }
}
