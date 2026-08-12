import { z } from 'zod';

const isoDate = z.string().date();
const today = () => new Date().toISOString().slice(0, 10);

export const applyDriverSchema = z.object({
  nidNumber: z.string().regex(/^(?:[0-9]{10}|[0-9]{13}|[0-9]{17})$/, 'NID must contain 10, 13, or 17 digits'),
  licenseNumber: z.string().trim().min(1).max(30),
  licenseExpiry: isoDate.refine((value) => value > today(), 'Driving license must not be expired'),
});

const documentDates = (schema) => schema.refine(
  ({ issueDate, expiryDate }) => !issueDate || !expiryDate || expiryDate > issueDate,
  { path: ['expiryDate'], message: 'Expiry date must be after issue date' },
);

const documentFields = {
  fileUrl: z.string().url().max(2048),
  docNumber: z.string().trim().min(1).max(60).optional(),
  issueDate: isoDate.optional(),
  expiryDate: isoDate.optional(),
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

// doc 08-09-10 §6: GET /driver/earnings "?from&to". Defaults to the
// trailing 30 days so the screen has something to show with no params —
// matches doc 12 §7's "date-range chips" (a UI default, not a required one).
export const earningsQuerySchema = z.object({
  from: isoDate.default(() => new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
  to: isoDate.default(today),
});

// doc 08-09-10 §8: POST /driver/payout-accounts. accountNo is the RAW
// number — read once here to compute the mask (utils/mask.js), never
// stored or logged past that (schema.sql: "numbers stored masked").
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
  // driver_payout_accounts.id is BIGINT — node-postgres returns BIGINT
  // columns as strings (can't safely fit the full range in a JS number),
  // so a client passing an id straight through from an earlier response
  // sends a numeric STRING, not a JSON number. coerce accepts both.
  payoutAccountId: z.coerce.number().int().positive(),
});
