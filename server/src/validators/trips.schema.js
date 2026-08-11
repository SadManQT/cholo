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

export const tripListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['active', 'assigned', 'arrived', 'in_progress', 'completed', 'cancelled']).optional(),
  role: z.enum(['passenger', 'driver']).optional(),
});

export const tripMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  messageType: z.enum(['text', 'quick_reply']).default('text'),
});

export const sosSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
