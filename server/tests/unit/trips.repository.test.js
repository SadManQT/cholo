import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import {
  completeTrip,
  findActiveTripIdForUser,
  findByCodeForUpdate,
  hasCompletedTrip,
  insertCancellation,
  insertLocationPing,
  insertTrip,
  markArrived,
  markCancelled,
  markStarted,
} from '../../src/repositories/trips.repository.js';

after(async () => {
  await pool.end();
});

test('insertTrip writes request/passenger/driver/vehicle with a parameterized query', async () => {
  let capturedSql;
  let capturedValues;

  mock.method(pool, 'query', async (sql, values) => {
    capturedSql = sql;
    capturedValues = values;
    return { rows: [{ id: 1, tripCode: 'JT-2026-000001', status: 'assigned', assignedAt: new Date() }] };
  });

  const trip = await insertTrip({ requestId: 38, passengerId: 9, driverId: 42, vehicleId: 7 });

  assert.match(capturedSql, /INSERT INTO trips/);
  assert.deepEqual(capturedValues, [38, 9, 42, 7]);
  assert.equal(trip.status, 'assigned');
  assert.match(trip.tripCode, /^JT-\d{4}-\d{6}$/);
});

test('findByCodeForUpdate joins ride_requests and locks only the trips row', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /JOIN ride_requests rr ON rr\.id = t\.request_id/);
    assert.match(sql, /WHERE t\.trip_code = \$1/);
    assert.match(sql, /FOR UPDATE OF t/);
    assert.deepEqual(values, ['JT-2026-000005']);
    return { rows: [{ id: 1, status: 'assigned' }] };
  });

  await findByCodeForUpdate('JT-2026-000005', pool);
  assert.equal(query.mock.callCount(), 1);
});

test('markArrived sets status=arrived and stamps arrived_at', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /status = 'arrived', arrived_at = now\(\)/);
    assert.deepEqual(values, [1]);
    return { rows: [{ tripCode: 'JT-2026-000005', status: 'arrived', arrivedAt: new Date() }] };
  });

  const result = await markArrived(1, pool);
  assert.equal(result.status, 'arrived');
  assert.equal(query.mock.callCount(), 1);
});

test('markStarted sets status=in_progress and stamps started_at', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /status = 'in_progress', started_at = now\(\)/);
    assert.deepEqual(values, [1]);
    return { rows: [{ tripCode: 'JT-2026-000005', status: 'in_progress', startedAt: new Date() }] };
  });

  const result = await markStarted(1, pool);
  assert.equal(result.status, 'in_progress');
  assert.equal(query.mock.callCount(), 1);
});

test('completeTrip writes actual distance/duration and the full fare breakdown', async () => {
  let capturedValues;
  mock.method(pool, 'query', async (sql, values) => {
    capturedValues = values;
    assert.match(sql, /status = 'completed', completed_at = now\(\)/);
    return {
      rows: [{
        tripCode: 'JT-2026-000005', status: 'completed', completedAt: new Date(),
        baseFare: '60.00', distanceFare: '202.62', timeFare: '22.50', waitingFare: '0.00',
        surgeAmount: '0.00', bookingFee: '10.00', discountAmount: '0.00', totalFare: '295.12',
        currency: 'BDT', paymentStatus: 'unpaid',
      }],
    };
  });

  const result = await completeTrip(1, {
    actualDistanceKm: 9.21,
    actualDurationMin: 9,
    fare: {
      baseFare: 60, distanceFare: 202.62, timeFare: 22.5, waitingFare: 0,
      surgeAmount: 0, bookingFee: 10, discountAmount: 0, totalFare: 295.12,
    },
  }, pool);

  assert.deepEqual(capturedValues, [1, 9.21, 9, 60, 202.62, 22.5, 0, 0, 10, 0, 295.12, 'unpaid']);
  assert.equal(result.status, 'completed');
  assert.equal(result.totalFare, '295.12');
});

test('completeTrip passes paymentStatus through when provided (cash settlement)', async () => {
  let capturedValues;
  mock.method(pool, 'query', async (sql, values) => {
    capturedValues = values;
    assert.match(sql, /payment_status = \$12/);
    return {
      rows: [{
        tripCode: 'JT-2026-000006', status: 'completed', completedAt: new Date(),
        baseFare: '60.00', distanceFare: '0.00', timeFare: '0.00', waitingFare: '0.00',
        surgeAmount: '0.00', bookingFee: '10.00', discountAmount: '0.00', totalFare: '70.00',
        currency: 'BDT', paymentStatus: 'paid',
      }],
    };
  });

  const result = await completeTrip(1, {
    actualDistanceKm: 0,
    actualDurationMin: 0,
    fare: {
      baseFare: 60, distanceFare: 0, timeFare: 0, waitingFare: 0,
      surgeAmount: 0, bookingFee: 10, discountAmount: 0, totalFare: 70,
    },
    paymentStatus: 'paid',
  }, pool);

  assert.equal(capturedValues.at(-1), 'paid');
  assert.equal(result.paymentStatus, 'paid');
});

test('markCancelled sets status=cancelled', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /SET status = 'cancelled'/);
    assert.deepEqual(values, [1]);
    return { rows: [{ tripCode: 'JT-2026-000005', status: 'cancelled' }] };
  });

  const result = await markCancelled(1, pool);
  assert.equal(result.status, 'cancelled');
  assert.equal(query.mock.callCount(), 1);
});

test('insertCancellation writes the weak-entity row and defaults reasonText to null', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /INSERT INTO trip_cancellations/);
    assert.deepEqual(values, [1, 'passenger', 42, 'changed_mind', null, 0]);
    return { rows: [{ cancelledAt: new Date(), feeCharged: '0.00' }] };
  });

  const result = await insertCancellation(1, {
    cancelledByRole: 'passenger',
    cancelledBy: 42,
    reasonCode: 'changed_mind',
    feeCharged: 0,
  }, pool);

  assert.equal(result.feeCharged, '0.00');
  assert.equal(query.mock.callCount(), 1);
});

test('findActiveTripIdForUser matches either side of the trip and only non-terminal statuses', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /driver_id = \$1 OR passenger_id = \$1/);
    assert.match(sql, /status IN \('assigned', 'arrived', 'in_progress'\)/);
    assert.deepEqual(values, [42]);
    return { rows: [{ id: 7 }] };
  });

  const tripId = await findActiveTripIdForUser(42, pool);
  assert.equal(tripId, 7);
  assert.equal(query.mock.callCount(), 1);
});

test('findActiveTripIdForUser returns undefined when the user has no active trip', async () => {
  mock.method(pool, 'query', async () => ({ rows: [] }));
  const tripId = await findActiveTripIdForUser(42, pool);
  assert.equal(tripId, undefined);
});

test('insertLocationPing writes a breadcrumb row, defaulting heading/speed to null', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /INSERT INTO trip_location_pings/);
    assert.deepEqual(values, [7, 23.79, 90.40, null, null]);
    return { rows: [] };
  });

  await insertLocationPing(7, { lat: 23.79, lng: 90.40 }, pool);
  assert.equal(query.mock.callCount(), 1);
});

test('hasCompletedTrip checks for any completed trip by this passenger', async () => {
  const query = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /WHERE passenger_id = \$1 AND status = 'completed'/);
    assert.deepEqual(values, [42]);
    return { rows: [{ exists: true }] };
  });

  const result = await hasCompletedTrip(42, pool);

  assert.equal(result, true);
  assert.equal(query.mock.callCount(), 1);
});
