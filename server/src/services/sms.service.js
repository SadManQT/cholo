import { logger } from '../utils/logger.js';

// Mocked gateway: every real SMS provider sits behind this same function
// signature, so swapping in bKash-style or Twilio-style senders later is a
// config change, not a rewrite (doc 06 §8 adapter pattern).
export function sendOtpSms(phone, otp) {
  logger.info('Mock SMS sent', { phone, message: `Your Cholo code: ${otp}` });
}
