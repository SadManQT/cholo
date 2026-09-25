import * as driversRepo from '../repositories/drivers.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';
import * as trackingService from '../services/tracking.service.js';
import { locationUpdateSchema } from '../validators/tracking.schema.js';
import { tripRoom } from './rooms.js';

export function registerLocationHandler(io, socket) {
  socket.on('location:update', async (payload) => {
    if (!socket.user.roles.includes('DRIVER')) return;

    if (Date.now() >= socket.user.tokenExpiresAt) {
      socket.disconnect(true);
      return;
    }

    const parsed = locationUpdateSchema.safeParse(payload);
    if (!parsed.success) return;

    const tripId = await tripsRepo.findActiveTripIdForUser(socket.user.id);
    if (!tripId) {
      // Online and waiting: keep the dispatch position fresh so offers go to where the driver is now.
      await driversRepo.updateLocation(socket.user.id, parsed.data);
      return;
    }

    await trackingService.recordLocationPing(socket.user.id, tripId, parsed.data);

    socket.to(tripRoom(tripId)).emit('location:update', {
      tripId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      heading: parsed.data.heading ?? null,
      at: new Date().toISOString(),
    });
  });
}
