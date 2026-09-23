import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import express, { Router } from 'express';

import { env } from '../config/env.js';
import { auth } from '../middlewares/auth.js';
import { supportMutationLimiter } from '../middlewares/rateLimit.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const MAX_BYTES = 5 * 1024 * 1024;

// The declared Content-Type is only a claim; the file's first bytes must agree.
const SIGNATURES = {
  'image/jpeg': { ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  'image/webp': { ext: 'webp', matches: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { ext: 'pdf', matches: (b) => b.subarray(0, 4).toString() === '%PDF' },
};

// Files are stored under unguessable names. Supabase Storage in production (a public bucket), local disk in dev.
// ponytail: capability URLs; switch the bucket to private + signed URLs if documents need access control.
async function storeFile(name, body, contentType) {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    const base = env.SUPABASE_URL.replace(/\/$/, '');
    const response = await fetch(`${base}/storage/v1/object/${env.SUPABASE_BUCKET}/${name}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        'content-type': contentType,
        'cache-control': 'max-age=31536000',
      },
      body,
    });
    if (!response.ok) {
      throw new Error(`Supabase Storage upload failed: ${response.status} ${await response.text()}`);
    }
    return `${base}/storage/v1/object/public/${env.SUPABASE_BUCKET}/${name}`;
  }

  await mkdir(env.UPLOAD_DIR, { recursive: true });
  await writeFile(join(env.UPLOAD_DIR, name), body);
  return `${env.PUBLIC_API_ORIGIN}/uploads/${name}`;
}

const router = Router();

router.post(
  '/',
  auth,
  supportMutationLimiter,
  express.raw({ type: Object.keys(SIGNATURES), limit: MAX_BYTES }),
  asyncHandler(async (request, response) => {
    const kind = SIGNATURES[request.headers['content-type']?.split(';')[0]];
    if (!kind || !Buffer.isBuffer(request.body) || request.body.length === 0) {
      throw new AppError(415, 'UNSUPPORTED_FILE');
    }
    if (!kind.matches(request.body)) throw new AppError(415, 'UNSUPPORTED_FILE');

    const name = `${randomBytes(16).toString('hex')}.${kind.ext}`;
    const url = await storeFile(name, request.body, request.headers['content-type'].split(';')[0]);
    response.status(201).json({ success: true, data: { url } });
  }),
);

export default router;
