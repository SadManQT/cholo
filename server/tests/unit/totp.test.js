import assert from 'node:assert/strict';
import { test } from 'node:test';

import { base32Decode, base32Encode, totpCode, verifyTotp } from '../../src/utils/totp.js';

// RFC 6238 appendix B, SHA-1 seed "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

test('totpCode matches the RFC 6238 SHA-1 test vectors (last 6 digits)', () => {
  assert.equal(totpCode(RFC_SECRET, 59_000), '287082');
  assert.equal(totpCode(RFC_SECRET, 1_111_111_109_000), '081804');
  assert.equal(totpCode(RFC_SECRET, 1_234_567_890_000), '005924');
  assert.equal(totpCode(RFC_SECRET, 20_000_000_000_000), '353130');
});

test('base32 round-trips', () => {
  const bytes = Buffer.from('any carnal pleasure');
  assert.deepEqual(base32Decode(base32Encode(bytes)), bytes);
});

test('verifyTotp accepts one step of clock drift and rejects older codes or junk', () => {
  const now = 1_700_000_000_000;
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 30_000), now), true);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now + 30_000), now), true);
  assert.equal(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, now - 90_000), now), false);
  assert.equal(verifyTotp(RFC_SECRET, '12345', now), false);
  assert.equal(verifyTotp(RFC_SECRET, undefined, now), false);
});
