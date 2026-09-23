import { logger } from '../utils/logger.js';

export function sendOtpSms(phone, otp) {
  logger.info('Mock SMS sent', { phone, message: `Your Cholo code: ${otp}` });
}
