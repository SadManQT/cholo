import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { listCities } from '../../src/controllers/cities.controller.js';

after(async () => {
  await pool.end();
});

test('listCities forwards repository failures to Express', async () => {
  const databaseError = new Error('database unavailable');
  let forwardedError;
  let responseWasSent = false;

  mock.method(pool, 'query', async () => {
    throw databaseError;
  });

  const response = {
    json() {
      responseWasSent = true;
    },
  };

  await listCities(undefined, response, (error) => {
    forwardedError = error;
  });

  assert.equal(responseWasSent, false);
  assert.equal(forwardedError, databaseError);
});
