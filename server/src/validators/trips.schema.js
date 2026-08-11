import { z } from 'zod';

export const tripCodeParamsSchema = z.object({
  tripCode: z.string().regex(/^JT-\d{4}-\d{6}$/, 'Invalid trip code'),
});

export const completeTripSchema = z.object({
  waitingMin: z.number().int().min(0).optional(),
});

// cancellation_reason_code (schema.sql) — the exact enum values, so an
// invalid reason is a 422 here, not a raw DB error from the INSERT.
export const cancelTripSchema = z.object({
  reasonCode: z.enum(['changed_mind', 'driver_late', 'no_show', 'wrong_pickup', 'vehicle_issue', 'other']),
  reasonText: z.string().trim().min(1).max(255).optional(),
});
