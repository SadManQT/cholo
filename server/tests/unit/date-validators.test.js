import assert from 'node:assert/strict';
import test from 'node:test';

import {
  analyticsQuerySchema, createPromoSchema, createSurgeSchema, exportQuerySchema, publishPricingRuleSchema, suspendUserSchema,
} from '../../src/validators/admin.schema.js';
import {
  applyDriverSchema, createDriverDocumentSchema, earningsQuerySchema, statementParamsSchema,
} from '../../src/validators/driver.schema.js';
import { dhakaDate } from '../../src/utils/dhakaDate.js';

const ok = (schema, value) => schema.safeParse(value).success;
const inDays = (days) => new Date(Date.now() + days * 86_400_000).toISOString();
const thisMonth = dhakaDate().slice(0, 7);

test('impossible and absurd calendar dates are rejected', () => {
  const apply = { nidNumber: '1234567890', licenseNumber: 'DK-1' };
  assert.ok(ok(applyDriverSchema, { ...apply, licenseExpiry: dhakaDate(365 * 5) }));
  assert.ok(!ok(applyDriverSchema, { ...apply, licenseExpiry: '2027-02-30' }));
  assert.ok(!ok(applyDriverSchema, { ...apply, licenseExpiry: '9999-12-31' }));
  assert.ok(!ok(applyDriverSchema, { ...apply, licenseExpiry: dhakaDate(-1) }));

  const doc = { docType: 'license', fileUrl: 'x' };
  const docDates = (issueDate, expiryDate) => createDriverDocumentSchema.safeParse({ ...doc, issueDate, expiryDate }).error?.issues
    .filter((issue) => issue.path[0] !== 'fileUrl').length ?? 0;
  assert.equal(docDates(dhakaDate(-365), dhakaDate(365)), 0);
  assert.ok(docDates(dhakaDate(30), dhakaDate(365)) > 0, 'issued in the future');
  assert.ok(docDates('0001-01-01', dhakaDate(365)) > 0, 'issued in year 1');
  assert.ok(docDates(dhakaDate(-365), dhakaDate(-1)) > 0, 'already expired');
  assert.ok(docDates(dhakaDate(-365), '9999-01-01') > 0, 'expires in year 9999');
});

test('date ranges must be in order, bounded and not in the future', () => {
  assert.ok(ok(earningsQuerySchema, { from: dhakaDate(-7), to: dhakaDate() }));
  assert.ok(!ok(earningsQuerySchema, { from: dhakaDate(), to: dhakaDate(-7) }));
  assert.ok(!ok(earningsQuerySchema, { from: '1900-01-01', to: dhakaDate() }));
  assert.ok(!ok(earningsQuerySchema, { from: dhakaDate(), to: dhakaDate(30) }));

  assert.ok(ok(exportQuerySchema, { from: dhakaDate(-30), to: dhakaDate() }));
  assert.ok(!ok(exportQuerySchema, { from: '2026-13-45', to: dhakaDate() }));
  assert.ok(!ok(exportQuerySchema, { from: dhakaDate(), to: dhakaDate(10) }));

  for (const schema of [statementParamsSchema, analyticsQuerySchema]) {
    assert.ok(ok(schema, { month: thisMonth }));
    assert.ok(!ok(schema, { month: '2999-01' }));
    assert.ok(!ok(schema, { month: '0001-01' }));
    assert.ok(!ok(schema, { month: '2026-13' }));
  }
});

test('admin schedules: end after start, end in the future, nothing centuries away', () => {
  const reason = 'Repeated no-shows';
  assert.ok(ok(suspendUserSchema, { reason, duration: 'custom', until: inDays(30) }));
  assert.ok(!ok(suspendUserSchema, { reason, duration: 'custom', until: inDays(-1) }));
  assert.ok(!ok(suspendUserSchema, { reason, duration: 'custom', until: '9999-01-01T00:00:00Z' }));

  const promo = { code: 'SAVE10', promoType: 'fixed_amount', value: 10, validFrom: inDays(0) };
  const promoOk = (extra) => !createPromoSchema.safeParse({ ...promo, ...extra }).error?.issues
    .some((issue) => ['validFrom', 'validUntil'].includes(issue.path[0]));
  assert.ok(promoOk({ validUntil: inDays(30) }));
  assert.ok(!promoOk({ validUntil: inDays(-1) }), 'already ended');
  assert.ok(!promoOk({ validFrom: inDays(10), validUntil: inDays(5) }), 'ends before it starts');
  assert.ok(!promoOk({ validFrom: '1970-01-01T00:00:00Z' }), 'starts in 1970');

  const surge = { zoneId: 1, multiplier: 1.5, reason: 'demand' };
  assert.ok(ok(createSurgeSchema, { ...surge, endsAt: inDays(1) }));
  assert.ok(!ok(createSurgeSchema, { ...surge, endsAt: inDays(-1) }));
  assert.ok(!ok(createSurgeSchema, { ...surge, startsAt: inDays(365) }));

  const card = { cityId: 1, categoryId: 1, baseFare: 30, perKmRate: 15, perMinRate: 2, minimumFare: 60 };
  const pricingOk = (extra) => !publishPricingRuleSchema.safeParse({ ...card, ...extra }).error?.issues
    .some((issue) => ['effectiveFrom', 'effectiveTo'].includes(issue.path[0]));
  assert.ok(pricingOk({ effectiveFrom: inDays(1) }));
  assert.ok(!pricingOk({ effectiveFrom: '3000-01-01T00:00:00Z' }));
  assert.ok(!pricingOk({ effectiveFrom: inDays(1), effectiveTo: inDays(-1) }));
});
