import * as driversRepo from '../repositories/drivers.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';

export async function recordLocationPing(driverId, tripId, { lat, lng, heading, speedKmh }) {
  await tripsRepo.insertLocationPing(tripId, { lat, lng, heading, speedKmh });
  await driversRepo.updateLocation(driverId, { lat, lng, heading });
}
