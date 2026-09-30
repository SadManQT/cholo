import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

process.env.SMS_PROVIDER = 'bulksmsbd';
process.env.BULKSMSBD_API_KEY = 'test-key';
process.env.BULKSMSBD_SENDER_ID = '8809617600000';

const { otpMessage, sendOtpSms } = await import('../../src/services/sms.service.js');

afterEach(() => {
  mock.restoreAll();
});

test('otpMessage() uses the format BulkSMSBD requires for OTPs', () => {
  assert.equal(otpMessage('123456'), 'Your Cholo OTP is 123456');
});

test('sendOtpSms() posts to BulkSMSBD with the 880-prefixed number', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://bulksmsbd.net/api/smsapi');
    assert.equal(options.method, 'POST');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('api_key'), 'test-key');
    assert.equal(body.get('senderid'), '8809617600000');
    assert.equal(body.get('type'), 'text');
    assert.equal(body.get('number'), '8801712345678');
    assert.equal(body.get('message'), 'Your Cholo OTP is 123456');
    return { status: 200, json: async () => ({ response_code: 202, success_message: 'SMS Submitted Successfully' }) };
  });

  await sendOtpSms('01712345678', '123456');
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('sendOtpSms() throws SMS_SEND_FAILED when the gateway rejects the message', async () => {
  mock.method(console, 'error', () => {});
  mock.method(globalThis, 'fetch', async () => ({
    status: 200,
    json: async () => ({ response_code: 1007, error_message: 'Balance Insufficient' }),
  }));

  await assert.rejects(() => sendOtpSms('01712345678', '123456'), { status: 502, code: 'SMS_SEND_FAILED' });
});
