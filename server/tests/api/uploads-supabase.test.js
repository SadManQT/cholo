import assert from 'node:assert/strict';
import { once } from 'node:events';
import { after, before, mock, test } from 'node:test';

process.env.SUPABASE_URL = 'https://example-project.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-for-tests-only';

const { default: app } = await import('../../src/app.js');
const { pool } = await import('../../src/config/db.js');
const { signAccessToken } = await import('../../src/utils/tokens.js');

let server;
let baseUrl;
const realFetch = globalThis.fetch;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await pool.end();
});

test('with Supabase configured, uploads go to Storage and return its public URL', async () => {
  const storageCalls = [];
  mock.method(globalThis, 'fetch', async (url, init) => {
    if (String(url).startsWith('https://example-project.supabase.co')) {
      storageCalls.push({ url: String(url), init });
      return new Response('{}', { status: 200 });
    }
    return realFetch(url, init);
  });

  const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
  const response = await fetch(`${baseUrl}/api/v1/uploads`, {
    method: 'POST',
    headers: { 'content-type': 'image/png', authorization: `Bearer ${signAccessToken({ userId: 1, roles: ['DRIVER'], sessionId: 1 })}` },
    body: png,
  });

  assert.equal(response.status, 201);
  const { url } = (await response.json()).data;
  assert.match(url, /^https:\/\/example-project\.supabase\.co\/storage\/v1\/object\/public\/uploads\/[0-9a-f]{32}\.png$/);
  assert.equal(storageCalls.length, 1);
  assert.match(storageCalls[0].url, /\/storage\/v1\/object\/uploads\/[0-9a-f]{32}\.png$/);
  assert.equal(storageCalls[0].init.headers.authorization, 'Bearer service-role-key-for-tests-only');
  assert.equal(storageCalls[0].init.headers['content-type'], 'image/png');
  mock.restoreAll();
});
