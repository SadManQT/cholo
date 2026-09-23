import * as earningsRepo from '../repositories/earnings.repository.js';

export async function getEarnings(driverId, { from, to }) {
  const [daily, trips] = await Promise.all([
    earningsRepo.listDailyForDriver(driverId, { from, to }),
    earningsRepo.listTripsForDriver(driverId, { from, to }),
  ]);

  return { daily, trips };
}
