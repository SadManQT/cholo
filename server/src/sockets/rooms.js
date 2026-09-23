import * as tripsRepo from '../repositories/trips.repository.js';

export const userRoom = (userId) => `user:${userId}`;
export const driverRoom = (driverId) => `driver:${driverId}`;
export const tripRoom = (tripId) => `trip:${tripId}`;

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

export async function ensureTripParticipantsInRoom(io, tripId, { passengerId, driverId }) {
  await io.in(userRoom(passengerId)).socketsJoin(tripRoom(tripId));
  await io.in(userRoom(driverId)).socketsJoin(tripRoom(tripId));
}

export async function broadcastTripStatus(io, trip, payload) {
  await ensureTripParticipantsInRoom(io, trip.id, { passengerId: trip.passengerId, driverId: trip.driverId });
  io.to(tripRoom(trip.id)).emit('trip:status', payload);
}
