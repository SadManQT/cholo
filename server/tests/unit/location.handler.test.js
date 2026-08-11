import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import { registerLocationHandler } from '../../src/sockets/location.handler.js';
import { tripRoom } from '../../src/sockets/rooms.js';

after(async () => {
  await pool.end();
});

function fakeSocket({ id, roles, tokenExpiresAt = Date.now() + 60_000 }) {
  const handlers = {};
  const toEmitCalls = [];
  let disconnected = false;

  return {
    user: { id, roles, tokenExpiresAt },
    handlers,
    toEmitCalls,
    get disconnected() { return disconnected; },
    on(event, handler) {
      handlers[event] = handler;
    },
    disconnect() {
      disconnected = true;
    },
    to(room) {
      return { emit: (event, payload) => toEmitCalls.push({ room, event, payload }) };
    },
  };
}

async function emit(socket, payload) {
  await socket.handlers['location:update'](payload);
}

test('a non-driver emitting location:update is silently dropped (no query, no broadcast)', async () => {
  const query = mock.method(pool, 'query', async () => ({ rows: [] }));
  const socket = fakeSocket({ id: 9, roles: ['PASSENGER'] });
  registerLocationHandler({}, socket);

  await emit(socket, { lat: 23.79, lng: 90.40 });

  assert.equal(query.mock.callCount(), 0);
  assert.equal(socket.toEmitCalls.length, 0);
});

test('an expired token forces a disconnect instead of processing the ping', async () => {
  const query = mock.method(pool, 'query', async () => ({ rows: [] }));
  const socket = fakeSocket({ id: 42, roles: ['DRIVER'], tokenExpiresAt: Date.now() - 1000 });
  registerLocationHandler({}, socket);

  await emit(socket, { lat: 23.79, lng: 90.40 });

  assert.equal(socket.disconnected, true);
  assert.equal(query.mock.callCount(), 0);
});

test('a malformed payload is dropped without touching the database', async () => {
  const query = mock.method(pool, 'query', async () => ({ rows: [] }));
  const socket = fakeSocket({ id: 42, roles: ['DRIVER'] });
  registerLocationHandler({}, socket);

  await emit(socket, { lat: 'not-a-number', lng: 90.40 });

  assert.equal(query.mock.callCount(), 0);
});

test('a driver with no active trip: pings are dropped (nothing to attach them to)', async () => {
  const query = mock.method(pool, 'query', async () => ({ rows: [] })); // findActiveTripIdForUser -> no row
  const socket = fakeSocket({ id: 42, roles: ['DRIVER'] });
  registerLocationHandler({}, socket);

  await emit(socket, { lat: 23.79, lng: 90.40 });

  assert.equal(query.mock.callCount(), 1); // only the active-trip lookup, no ping insert
  assert.equal(socket.toEmitCalls.length, 0);
});

test('a valid ping from a driver on an active trip is recorded and broadcast to the trip room (not echoed to itself)', async () => {
  const queries = [];
  mock.method(pool, 'query', async (sql, values) => {
    queries.push(sql);
    if (sql.includes('FROM trips')) return { rows: [{ id: 7 }] };
    return { rows: [] };
  });
  const socket = fakeSocket({ id: 42, roles: ['DRIVER'] });
  registerLocationHandler({}, socket);

  await emit(socket, { lat: 23.79, lng: 90.40, heading: 45 });

  assert.equal(queries.length, 3); // findActiveTripIdForUser, insertLocationPing, updateLocation
  assert.match(queries[1], /INSERT INTO trip_location_pings/);
  assert.match(queries[2], /UPDATE driver_availability/);

  assert.equal(socket.toEmitCalls.length, 1);
  assert.equal(socket.toEmitCalls[0].room, tripRoom(7));
  assert.equal(socket.toEmitCalls[0].event, 'location:update');
  assert.equal(socket.toEmitCalls[0].payload.tripId, 7);
  assert.equal(socket.toEmitCalls[0].payload.lat, 23.79);
  assert.equal(socket.toEmitCalls[0].payload.heading, 45);
});
