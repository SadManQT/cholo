import assert from 'node:assert/strict';
import { after, mock, test } from 'node:test';

import { pool } from '../../src/config/db.js';
import {
  broadcastTripStatus,
  driverRoom,
  ensureTripParticipantsInRoom,
  joinIdentityRooms,
  tripRoom,
  userRoom,
} from '../../src/sockets/rooms.js';

after(async () => {
  await pool.end();
});

function fakeSocket({ id, roles }) {
  const joined = [];
  return {
    user: { id, roles },
    data: {},
    joined,
    join(room) {
      joined.push(room);
    },
  };
}

// A minimal stand-in for the socket.io Server/BroadcastOperator chain this
// module actually calls: io.in(room).socketsJoin(otherRoom) and
// io.to(room).emit(event, payload). Real behavior is covered by the
// socket.io-client integration test (tests/api/sockets.test.js) — this one
// is about rooms.js's own logic (who gets joined/emitted to, and when).
function fakeIo() {
  const socketsJoinCalls = [];
  const emitCalls = [];
  return {
    socketsJoinCalls,
    emitCalls,
    in(room) {
      return { socketsJoin: async (otherRoom) => socketsJoinCalls.push({ room, otherRoom }) };
    },
    to(room) {
      return { emit: (event, payload) => emitCalls.push({ room, event, payload }) };
    },
  };
}

test('joinIdentityRooms always joins user:{id}, and driver:{id} only for a DRIVER', async () => {
  mock.method(pool, 'query', async () => ({ rows: [] })); // no active trip

  const passengerSocket = fakeSocket({ id: 9, roles: ['PASSENGER'] });
  await joinIdentityRooms(passengerSocket);
  assert.deepEqual(passengerSocket.joined, [userRoom(9)]);

  const driverSocket = fakeSocket({ id: 42, roles: ['DRIVER'] });
  await joinIdentityRooms(driverSocket);
  assert.deepEqual(driverSocket.joined, [userRoom(42), driverRoom(42)]);
});

test('joinIdentityRooms also joins trip:{id} when the DB reports an active trip, and caches it on socket.data', async () => {
  mock.method(pool, 'query', async () => ({ rows: [{ id: 7 }] }));

  const socket = fakeSocket({ id: 42, roles: ['DRIVER'] });
  await joinIdentityRooms(socket);

  assert.deepEqual(socket.joined, [userRoom(42), driverRoom(42), tripRoom(7)]);
  assert.equal(socket.data.activeTripId, 7);
});

test('ensureTripParticipantsInRoom pulls both participants\' own identity rooms into the trip room', async () => {
  const io = fakeIo();
  await ensureTripParticipantsInRoom(io, 7, { passengerId: 9, driverId: 42 });

  assert.deepEqual(io.socketsJoinCalls, [
    { room: userRoom(9), otherRoom: tripRoom(7) },
    { room: userRoom(42), otherRoom: tripRoom(7) },
  ]);
});

test('broadcastTripStatus ensures room membership before emitting trip:status to the trip room', async () => {
  const io = fakeIo();
  await broadcastTripStatus(io, { id: 7, passengerId: 9, driverId: 42 }, { status: 'arrived' });

  assert.equal(io.socketsJoinCalls.length, 2);
  assert.deepEqual(io.emitCalls, [{ room: tripRoom(7), event: 'trip:status', payload: { status: 'arrived' } }]);
});
