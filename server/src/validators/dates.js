import { z } from 'zod';

import { dhakaDate } from '../utils/dhakaDate.js';

// Shared date rules. Zod already rejects impossible dates (2026-02-31, 2027-02-29); these add sane ranges
// so values like year 0001 or 9999 never reach the database.

const YEAR_MS = 365.25 * 86_400_000;

/** YYYY-MM-DD in Asia/Dhaka, `years` whole years from today (negative for the past). */
export const dhakaDateInYears = (years) => dhakaDate(Math.round(years * 365.25));

export const isoDate = z.string().date('Use a real date (YYYY-MM-DD)');
export const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
export const isoDateTime = z.iso.datetime({ offset: true });

/** A past month for reports: not in the future and at most ten years back. */
export const pastMonth = isoMonth
  .refine((month) => month <= dhakaDate().slice(0, 7), 'Month cannot be in the future')
  .refine((month) => month >= dhakaDateInYears(-10).slice(0, 7), 'Month is too far in the past');

/** A timestamp between `pastYears` ago and `futureYears` ahead. */
export const dateTimeWithin = (pastYears, futureYears) => isoDateTime
  .refine((value) => new Date(value).getTime() >= Date.now() - pastYears * YEAR_MS, 'Date is too far in the past')
  .refine((value) => new Date(value).getTime() <= Date.now() + futureYears * YEAR_MS, 'Date is too far in the future');

export const isFuture = (value) => new Date(value).getTime() > Date.now();
