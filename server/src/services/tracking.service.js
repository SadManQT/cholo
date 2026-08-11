import * as driversRepo from '../repositories/drivers.repository.js';
import * as tripsRepo from '../repositories/trips.repository.js';

// No withTransaction: the breadcrumb log and the "current position" cache
// are independent, best-effort writes at a ~4s cadence — nothing reads them
// atomically together, and losing one to the other's failure only costs a
// single ping that the next one supersedes.
export async function recordLocationPing(driverId, tripId, { lat, lng, heading, speedKmh }) {
  await tripsRepo.insertLocationPing(tripId, { lat, lng, heading, speedKmh });
  await driversRepo.updateLocation(driverId, { lat, lng, heading });
}
