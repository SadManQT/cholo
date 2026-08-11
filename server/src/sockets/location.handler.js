import * as tripsRepo from '../repositories/trips.repository.js';
import * as trackingService from '../services/tracking.service.js';
import { locationUpdateSchema } from '../validators/tracking.schema.js';
import { tripRoom } from './rooms.js';

// doc 05-06-07 §7's sequence diagram: driver emits location:update, the
// server writes it, then broadcasts to trip:{id} — read here as the SAME
// event name both directions (the doc's diagram uses "driver:location" for
// the outbound leg, but the task scope is exactly three event names total,
// and re-using location:update for the broadcast covers the same meaning
// without a fourth name).
export function registerLocationHandler(io, socket) {
  socket.on('location:update', async (payload) => {
    // Only a driver mid-trip has anything to broadcast — a passenger's
    // socket sending this is simply not a supported operation, dropped
    // silently rather than answered with a new error event (three events).
    if (!socket.user.roles.includes('DRIVER')) return;

    // doc 08-09-10 §10: "expired mid-connection? the next sensitive emit
    // re-checks and forces a reconnect." Handshake auth only proves the
    // token was valid AT CONNECT time — a socket can stay open long past a
    // 15-minute access token, so the one inbound event that writes anything
    // re-checks expiry here, and disconnects rather than silently trusting
    // a stale identity.
    if (Date.now() >= socket.user.tokenExpiresAt) {
      socket.disconnect(true);
      return;
    }

    const parsed = locationUpdateSchema.safeParse(payload);
    if (!parsed.success) return;

    // Resolved fresh, not from a connect-time cache: a driver can finish
    // one trip and pick up a new one without ever reconnecting, and a
    // ~4s-cadence query is cheap at this scale — same "recompute, don't
    // cache" reasoning as trips.service.js's completeTrip calling
    // geoService.route() live instead of trusting an earlier value.
    const tripId = await tripsRepo.findActiveTripIdForUser(socket.user.id);
    if (!tripId) return;

    await trackingService.recordLocationPing(socket.user.id, tripId, parsed.data);

    // socket.to (not io.to): the driver's own device doesn't need its GPS
    // echoed back to itself, only whoever else is in the room (the
    // passenger, per doc 05-06-07 §7's room table).
    socket.to(tripRoom(tripId)).emit('location:update', {
      tripId,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      heading: parsed.data.heading ?? null,
      at: new Date().toISOString(),
    });
  });
}
