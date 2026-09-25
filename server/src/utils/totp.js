import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

// RFC 6238 time-based codes (30 s, 6 digits, SHA-1): what Google Authenticator, Authy and 1Password expect.
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_SECONDS = 30;

export function base32Encode(buffer) {
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += ALPHABET[parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

export function base32Decode(text) {
  let bits = '';
  for (const char of text.replace(/=+$/, '').toUpperCase()) {
    const value = ALPHABET.indexOf(char);
    if (value === -1) throw new Error('Invalid base32');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2));
  return Buffer.from(bytes);
}

export const generateTotpSecret = () => base32Encode(randomBytes(20));

export function totpCode(secret, time = Date.now()) {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(time / 1000 / STEP_SECONDS)));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, '0');
}

/** Accepts the current code and one step either side, for phones whose clocks drift a little. */
export function verifyTotp(secret, code, time = Date.now()) {
  if (!/^\d{6}$/.test(code ?? '')) return false;
  return [-1, 0, 1].some((drift) => timingSafeEqual(
    Buffer.from(totpCode(secret, time + drift * STEP_SECONDS * 1000)),
    Buffer.from(code),
  ));
}

export function otpauthUrl(secret, accountName, issuer = 'Cholo Admin') {
  const label = encodeURIComponent(`${issuer}:${accountName}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${STEP_SECONDS}`;
}
