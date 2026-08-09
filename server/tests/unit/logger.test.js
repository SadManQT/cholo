import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { logger } from '../../src/utils/logger.js';

test('error logger keeps the stack trace in server logs', () => {
  let loggedLine;
  const error = new Error('diagnostic detail');

  mock.method(console, 'error', (line) => {
    loggedLine = line;
  });

  logger.error('Unhandled request error', error, {
    method: 'GET',
    path: '/test',
  });

  const entry = JSON.parse(loggedLine);

  assert.equal(entry.level, 'error');
  assert.equal(entry.message, 'Unhandled request error');
  assert.equal(entry.method, 'GET');
  assert.equal(entry.path, '/test');
  assert.equal(entry.error, 'diagnostic detail');
  assert.match(entry.stack, /Error: diagnostic detail/);
});
