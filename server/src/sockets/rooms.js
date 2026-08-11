import * as tripsRepo from '../repositories/trips.repository.js';

// doc 05-06-07 §7's room table: driver:{id} (dispatch offers), trip:{id}
// (the passenger + driver of that trip). user:{id} is this codebase's own
// small addition, not named in the doc — see ensureTripParticipantsInRoom
// below for why it exists.
export const userRoom = (userId) => `user:${userId}`;
export const driverRoom = (driverId) => `driver:${driverId}`;
export const tripRoom = (tripId) => `trip:${tripId}`;

// Run once per connection (sockets/index.js's 'connection' handler).
// user:{id} and driver:{id} need no DB check — both are just "is this you,"
// already proven by the verified JWT the handshake middleware attached to
// socket.user; nothing here lets a socket join an identity room that isn't
// its own. trip:{id} is the one doc 08-09-10 §10 calls out by name as
// needing "membership checks" — the driver_id/passenger_id match is a real
// query, not a client-asserted claim.
export async function joinIdentityRooms(socket) {
  socket.join(userRoom(socket.user.id));

  if (socket.user.roles.includes('DRIVER')) {
    socket.join(driverRoom(socket.user.id));
  }

  const activeTripId = await tripsRepo.findActiveTripIdForUser(socket.user.id);
  if (activeTripId) {
    socket.data.activeTripId = activeTripId;
    socket.join(tripRoom(activeTripId));
  }
}

// Closes a timing gap the doc's connect-time-only join can't: a socket that
// connected BEFORE a trip existed (e.g. a driver who's been online for
// hours) would never otherwise end up in trip:{id} once one is created,
// since nothing re-runs joinIdentityRooms for an open connection. Rather
// than add a client-facing "please join this trip" event (ruled out — three
// events, no more), the server pulls each participant's ALREADY-CONNECTED
// sockets from their own always-joined user:{id} room straight into the new
// trip room — pure server-side room management, invisible to the client,
// zero new events. Called wherever a trip is created or its status changes
// (dispatch.service.js's acceptOffer, every trips.service.js transition).
export async function ensureTripParticipantsInRoom(io, tripId, { passengerId, driverId }) {
  await io.in(userRoom(passengerId)).socketsJoin(tripRoom(tripId));
  await io.in(userRoom(driverId)).socketsJoin(tripRoom(tripId));
}

// dispatch.service.js (trip created) and every trips.service.js transition
// share this one path: guarantee both participants' live sockets are in the
// room, then emit. Callers pass the caller-side `io` (from sockets/index.js's
// getIO(), already null-checked before this is called) so this module has
// no dependency on how the io singleton is obtained.
export async function broadcastTripStatus(io, trip, payload) {
  await ensureTripParticipantsInRoom(io, trip.id, { passengerId: trip.passengerId, driverId: trip.driverId });
  io.to(tripRoom(trip.id)).emit('trip:status', payload);
}
