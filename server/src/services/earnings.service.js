import * as earningsRepo from '../repositories/earnings.repository.js';
import { AppError } from '../utils/AppError.js';
import { round2 } from '../utils/fareMath.js';

export async function getEarnings(driverId, { from, to }) {
  const [daily, trips] = await Promise.all([
    earningsRepo.listDailyForDriver(driverId, { from, to }),
    earningsRepo.listTripsForDriver(driverId, { from, to }),
  ]);

  return { daily, trips };
}

const STATEMENT_MONTHS = 12;

export const listStatements = (driverId) => earningsRepo.listMonthlyForDriver(driverId, STATEMENT_MONTHS);

export async function getStatement(driverId, month) {
  const statement = await earningsRepo.getStatementForMonth(driverId, month);
  if (!statement) throw new AppError(404, 'STATEMENT_NOT_FOUND');
  const sum = (key) => round2(statement.trips.reduce((total, trip) => total + trip[key], 0));
  return {
    statementNo: `ST-${month.replace('-', '')}-${driverId}`,
    month,
    driver: { name: statement.driverName, phone: statement.driverPhone, licenseNumber: statement.licenseNumber },
    totals: {
      tripsCount: statement.trips.length,
      grossTotal: sum('grossFare'),
      commissionTotal: sum('commissionAmount'),
      netTotal: sum('netEarning'),
    },
    trips: statement.trips,
    generatedAt: new Date().toISOString(),
  };
}
