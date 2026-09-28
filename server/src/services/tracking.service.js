import { withTransaction } from '../config/db.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';

// The breadcrumb and the driver's current position are saved together.
export async function recordLocationPing(driverId, tripId, { lat, lng, heading, speedKmh }) {
  await withTransaction(async (client) => {
    await tripsRepo.insertLocationPing(tripId, { lat, lng, heading, speedKmh }, client);
    await driversRepo.updateLocation(driverId, { lat, lng, heading }, client);
  });
}
