import { z } from 'zod';

import { isOwnFileUrl } from '../services/storage.service.js';
import { dhakaDate } from '../utils/dhakaDate.js';
import { dhakaDateInYears, isoDate, pastMonth } from './dates.js';

const today = () => dhakaDate();

// A document can't be issued in the future or before its holder could plausibly have it, and must not
// already be expired or claim to last longer than any Bangladeshi licence, NID or vehicle paper does.
const issueDate = isoDate
  .refine((value) => value <= today(), 'Issue date cannot be in the future')
  .refine((value) => value >= dhakaDateInYears(-60), 'Issue date is too far in the past');
const expiryDate = isoDate
  .refine((value) => value > today(), 'This document has already expired')
  .refine((value) => value <= dhakaDateInYears(20), 'Expiry date is too far in the future');

// BRTA issues driving licences for at most 10 years (non-professional; professional ones last 5), so a
// licence expiring later than that from today — or from its issue date — can't be genuine.
export const LICENSE_MAX_YEARS = 10;
const LICENSE_TOO_LONG = `A Bangladeshi driving license is valid for at most ${LICENSE_MAX_YEARS} years`;

export const applyDriverSchema = z.object({
  nidNumber: z.string().regex(/^(?:[0-9]{10}|[0-9]{13}|[0-9]{17})$/, 'NID must contain 10, 13, or 17 digits'),
  licenseNumber: z.string().trim().min(1).max(30),
  licenseExpiry: isoDate
    .refine((value) => value > today(), 'Driving license must not be expired')
    .refine((value) => value <= dhakaDateInYears(LICENSE_MAX_YEARS), LICENSE_TOO_LONG),
});

const addYears = (date, years) => `${Number(date.slice(0, 4)) + years}${date.slice(4)}`;

const documentDates = (schema) => schema
  .refine(
    ({ issueDate, expiryDate }) => !issueDate || !expiryDate || expiryDate > issueDate,
    { path: ['expiryDate'], message: 'Expiry date must be after issue date' },
  )
  .refine(
    ({ docType, issueDate, expiryDate }) => docType !== 'license' || !expiryDate
      || (expiryDate <= dhakaDateInYears(LICENSE_MAX_YEARS)
        && (!issueDate || expiryDate <= addYears(issueDate, LICENSE_MAX_YEARS))),
    { path: ['expiryDate'], message: LICENSE_TOO_LONG },
  );

const documentFields = {
  fileUrl: z.string().max(2048).refine(isOwnFileUrl, 'Upload the file with the document form'),
  docNumber: z.string().trim().min(1).max(60).optional(),
  issueDate: issueDate.optional(),
  expiryDate: expiryDate.optional(),
};

export const createDriverDocumentSchema = documentDates(z.object({
  docType: z.enum(['license', 'nid', 'photo', 'police_clearance']),
  ...documentFields,
}));

export const createVehicleDocumentSchema = documentDates(z.object({
  docType: z.enum(['registration', 'fitness', 'insurance', 'tax_token']),
  ...documentFields,
}));

export const createVehicleSchema = z.object({
  categoryId: z.number().int().positive(),
  registrationNo: z.string().trim().min(3).max(30).transform((value) => value.toUpperCase()),
  brand: z.string().trim().min(1).max(60).optional(),
  model: z.string().trim().min(1).max(60).optional(),
  modelYear: z.number().int().min(1990).max(2100).optional(),
  color: z.string().trim().min(1).max(30).optional(),
});

export const updateVehicleSchema = z
  .object({
    brand: z.string().trim().min(1).max(60).nullable().optional(),
    model: z.string().trim().min(1).max(60).nullable().optional(),
    modelYear: z.number().int().min(1990).max(2100).nullable().optional(),
    color: z.string().trim().min(1).max(30).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one editable vehicle field.',
  });

export const availabilitySchema = z
  .object({
    status: z.enum(['online', 'offline', 'break']),
    currentLat: z.number().min(-90).max(90).optional(),
    currentLng: z.number().min(-180).max(180).optional(),
    heading: z.number().min(0).max(360).optional(),
  })
  .refine(
    ({ currentLat, currentLng }) => (currentLat === undefined) === (currentLng === undefined),
    { path: ['currentLng'], message: 'Latitude and longitude must be provided together' },
  );

export const idParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const respondToOfferSchema = z.object({
  response: z.enum(['accepted', 'rejected']),
});

export const earningsQuerySchema = z.object({
  from: isoDate.default(() => dhakaDate(-29)),
  to: isoDate.default(today),
})
  .refine(({ from, to }) => from <= to, { path: ['to'], message: 'End date must be on or after the start' })
  .refine(({ to }) => to <= today(), { path: ['to'], message: 'End date cannot be in the future' })
  .refine(({ from, to }) => (new Date(to) - new Date(from)) / 86_400_000 <= 366, {
    path: ['from'], message: 'Choose at most one year at a time',
  });

export const createPayoutAccountSchema = z.object({
  accountType: z.enum(['bkash', 'nagad', 'bank']),
  accountName: z.string().trim().min(1).max(120),
  accountNo: z.string().trim().min(4).max(34),
  bankName: z.string().trim().min(1).max(80).optional(),
}).refine(
  ({ accountType, bankName }) => accountType !== 'bank' || !!bankName,
  { path: ['bankName'], message: 'bankName is required for a bank account' },
);

export const createWithdrawalSchema = z.object({
  amount: z.number().min(50),
  payoutAccountId: z.coerce.number().int().positive(),
});

export const statementParamsSchema = z.object({
  month: pastMonth,
});
