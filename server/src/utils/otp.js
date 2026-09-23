import { createHash, randomInt } from 'node:crypto';

export const OTP_TTL_MINUTES = 5;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(otp) {
  return createHash('sha256').update(otp).digest('hex');
}

export function otpExpiresAt() {
  return new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
}
