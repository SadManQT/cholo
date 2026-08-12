import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';

import { createSession, verifyTransaction } from '../../src/services/providers/sslcommerz.provider.js';

function jsonResponse(body, { ok = true } = {}) {
  return { ok, json: async () => body };
}

afterEach(() => {
  mock.restoreAll();
});

test('createSession() posts store credentials + amount + callbacks and returns the redirect URL', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.match(url, /\/gwprocess\/v4\/api\.php$/);
    assert.equal(options.method, 'POST');
    const body = new URLSearchParams(options.body);
    assert.equal(body.get('total_amount'), '144.90');
    assert.equal(body.get('currency'), 'BDT');
    assert.equal(body.get('tran_id'), 'pay-public-id-1');
    assert.equal(body.get('success_url'), 'http://client/success');
    assert.equal(body.get('ipn_url'), 'http://api/webhooks/payments/sslcommerz');
    assert.ok(body.get('store_id'));
    assert.ok(body.get('store_passwd'));
    return jsonResponse({ status: 'SUCCESS', sessionkey: 'SESSION123', GatewayPageURL: 'https://sandbox.sslcommerz.com/EasyCheckOut/abc' });
  });

  const result = await createSession({
    tranId: 'pay-public-id-1',
    amount: 144.90,
    customerName: 'Nusrat J.',
    customerEmail: 'nusrat@example.com',
    successUrl: 'http://client/success',
    failUrl: 'http://client/fail',
    cancelUrl: 'http://client/cancel',
    ipnUrl: 'http://api/webhooks/payments/sslcommerz',
  });

  assert.deepEqual(result, { redirectUrl: 'https://sandbox.sslcommerz.com/EasyCheckOut/abc', sessionKey: 'SESSION123' });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('createSession() throws GATEWAY_SESSION_FAILED when SSLCommerz reports anything but SUCCESS', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ status: 'FAILED', failedreason: 'Invalid store credential' }));

  await assert.rejects(
    () => createSession({
      tranId: 'x', amount: 10, customerName: 'X', customerEmail: 'x@example.com',
      successUrl: 'http://a', failUrl: 'http://b', cancelUrl: 'http://c', ipnUrl: 'http://d',
    }),
    (error) => {
      assert.equal(error.status, 502);
      assert.equal(error.code, 'GATEWAY_SESSION_FAILED');
      return true;
    },
  );
});

test('createSession() throws GATEWAY_UNAVAILABLE when the request itself fails', async () => {
  mock.method(globalThis, 'fetch', async () => { throw new Error('network down'); });

  await assert.rejects(
    () => createSession({
      tranId: 'x', amount: 10, customerName: 'X', customerEmail: 'x@example.com',
      successUrl: 'http://a', failUrl: 'http://b', cancelUrl: 'http://c', ipnUrl: 'http://d',
    }),
    (error) => {
      assert.equal(error.status, 503);
      assert.equal(error.code, 'GATEWAY_UNAVAILABLE');
      return true;
    },
  );
});

test('verifyTransaction() calls the Validation API and reports VALID as succeeded', async () => {
  const fetchMock = mock.method(globalThis, 'fetch', async (url) => {
    assert.match(url, /\/validator\/api\/validationserverAPI\.php\?/);
    assert.match(url, /val_id=val-123/);
    return jsonResponse({ status: 'VALID', tran_id: 'pay-public-id-1', amount: '144.90', bank_tran_id: 'BANK-987' });
  });

  const result = await verifyTransaction({ valId: 'val-123' });

  assert.deepEqual(result, { tranId: 'pay-public-id-1', succeeded: true, amount: 144.90, gatewayTxnId: 'BANK-987' });
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('verifyTransaction() reports VALIDATED (re-checked) as succeeded too', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ status: 'VALIDATED', tran_id: 't', amount: '10.00', bank_tran_id: 'b' }));

  const result = await verifyTransaction({ valId: 'val-123' });
  assert.equal(result.succeeded, true);
});

test('verifyTransaction() reports INVALID_TRANSACTION (unrecognized val_id) as not succeeded', async () => {
  mock.method(globalThis, 'fetch', async () => jsonResponse({ status: 'INVALID_TRANSACTION', tran_id: '', amount: '', bank_tran_id: '' }));

  const result = await verifyTransaction({ valId: 'nonexistent' });
  assert.equal(result.succeeded, false);
});
