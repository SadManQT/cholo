import { z } from 'zod';

import { dhakaDate } from '../utils/dhakaDate.js';

const YEAR_MS = 365.25 * 86_400_000;

export const dhakaDateInYears = (years) => dhakaDate(Math.round(years * 365.25));

export const isoDate = z.string().date('Use a real date (YYYY-MM-DD)');
export const isoMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Use YYYY-MM');
export const isoDateTime = z.iso.datetime({ offset: true });

export const pastMonth = isoMonth
  .refine((month) => month <= dhakaDate().slice(0, 7), 'Month cannot be in the future')
  .refine((month) => month >= dhakaDateInYears(-10).slice(0, 7), 'Month is too far in the past');

export const dateTimeWithin = (pastYears, futureYears) => isoDateTime
  .refine((value) => new Date(value).getTime() >= Date.now() - pastYears * YEAR_MS, 'Date is too far in the past')
  .refine((value) => new Date(value).getTime() <= Date.now() + futureYears * YEAR_MS, 'Date is too far in the future');

export const isFuture = (value) => new Date(value).getTime() > Date.now();
