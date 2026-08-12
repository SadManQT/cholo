import * as earningsRepo from '../repositories/earnings.repository.js';

// doc 08-09-10 §6: GET /driver/earnings — daily aggregates (straight from
// v_driver_daily_earnings, doc 08-09-10 §8's naming) plus per-trip rows,
// same date window for both.
export async function getEarnings(driverId, { from, to }) {
  const [daily, trips] = await Promise.all([
    earningsRepo.listDailyForDriver(driverId, { from, to }),
    earningsRepo.listTripsForDriver(driverId, { from, to }),
  ]);

  return { daily, trips };
}
