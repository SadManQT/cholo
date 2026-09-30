import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const BULKSMSBD_URL = 'https://bulksmsbd.net/api/smsapi';
const BULKSMSBD_SUBMITTED = 202;

// BulkSMSBD only delivers OTPs in this exact format: "Your {Brand} OTP is XXXX".
export function otpMessage(otp) {
  return `Your Cholo OTP is ${otp}`;
}

async function sendViaBulkSmsBd(phone, message) {
  const response = await fetch(BULKSMSBD_URL, {
    method: 'POST',
    body: new URLSearchParams({
      api_key: env.BULKSMSBD_API_KEY,
      type: 'text',
      senderid: env.BULKSMSBD_SENDER_ID,
      number: `88${phone}`,
      message,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const result = await response.json().catch(() => ({}));
  if (result.response_code !== BULKSMSBD_SUBMITTED) {
    // BulkSMSBD echoes the API key in some errors; keep it out of the logs.
    const reason = (result.error_message || 'unexpected response').replaceAll(env.BULKSMSBD_API_KEY, '[api key]');
    throw new Error(`BulkSMSBD ${result.response_code ?? response.status}: ${reason}`);
  }
}

export async function sendOtpSms(phone, otp) {
  const message = otpMessage(otp);
  if (env.SMS_PROVIDER === 'log') {
    logger.info('Mock SMS sent', { phone, message });
    return;
  }

  try {
    await sendViaBulkSmsBd(phone, message);
  } catch (error) {
    logger.error('SMS send failed', error, { phone });
    throw new AppError(502, 'SMS_SEND_FAILED');
  }
}
