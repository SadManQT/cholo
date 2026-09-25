import { randomBytes } from 'node:crypto';

import express, { Router } from 'express';

import { auth } from '../middlewares/auth.js';
import { supportMutationLimiter } from '../middlewares/rateLimit.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { readPrivateFile, storeFile } from '../services/storage.service.js';

const MAX_BYTES = 5 * 1024 * 1024;

// The declared Content-Type is only a claim; the file's first bytes must agree.
const SIGNATURES = {
  'image/jpeg': { ext: 'jpg', matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', matches: (b) => b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])) },
  'image/webp': { ext: 'webp', matches: (b) => b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP' },
  'application/pdf': { ext: 'pdf', matches: (b) => b.subarray(0, 4).toString() === '%PDF' },
};

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

    // ?private=true for identity and vehicle documents: stored privately, viewable only via signed links.
    const isPrivate = request.query.private === 'true';
    const name = `${randomBytes(16).toString('hex')}.${kind.ext}`;
    const url = await storeFile(name, request.body, request.headers['content-type'].split(';')[0], { isPrivate });
    response.status(201).json({ success: true, data: { url } });
  }),
);

// The signature is the credential (it expires after 10 minutes), so this is reachable from <img> and new tabs.
router.get(
  '/private/:name',
  asyncHandler(async (request, response) => {
    const file = await readPrivateFile(request.params.name, request.query);
    response.set({
      'Content-Type': file.contentType,
      'Cache-Control': 'private, max-age=600',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Content-Disposition': 'inline',
    });
    response.send(file.body);
  }),
);

export default router;
