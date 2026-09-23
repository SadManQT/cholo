import assert from 'node:assert/strict';
import { test } from 'node:test';

import { computeCommission } from '../../src/utils/commissionMath.js';

function assertIdentity({ grossFare, commissionAmount, netEarning }) {
  assert.equal(Math.round((grossFare - commissionAmount) * 100) / 100, netEarning);
}

test('computeCommission splits gross fare into commission + net at the given percentage', () => {
  const result = computeCommission({ grossFare: 387.80, commissionPct: 15 });

  assert.equal(result.commissionAmount, 58.17);
  assert.equal(result.netEarning, 329.63);
  assertIdentity({ grossFare: 387.80, ...result });
});

test('computeCommission rounds commissionAmount to 2dp before deriving netEarning', () => {
  const result = computeCommission({ grossFare: 33.33, commissionPct: 15 });

  assert.equal(result.commissionAmount, 5.00);
  assert.equal(result.netEarning, 28.33);
  assertIdentity({ grossFare: 33.33, ...result });
});

test('computeCommission at 0% leaves the driver the full fare', () => {
  const result = computeCommission({ grossFare: 130, commissionPct: 0 });

  assert.equal(result.commissionAmount, 0);
  assert.equal(result.netEarning, 130);
});

test('computeCommission at 100% leaves the driver nothing', () => {
  const result = computeCommission({ grossFare: 130, commissionPct: 100 });

  assert.equal(result.commissionAmount, 130);
  assert.equal(result.netEarning, 0);
});
