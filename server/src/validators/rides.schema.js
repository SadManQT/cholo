import { z } from 'zod';

const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

// cities.id and vehicle_categories.id are both SMALLINT (schema.sql) —
// bounded here so an oversized id is a clean 422, not a raw DB error.
const smallintId = z.number().int().positive().max(32_767);

export const quoteSchema = z.object({
  cityId: smallintId,
  categoryId: smallintId,
  pickup: coordinate,
  dropoff: coordinate,
});

// doc 08-09-10 §11 lists pickup.address as "3–300", but ride_requests.
// pickup_address/dropoff_address are VARCHAR(255) in the actual shipped
// schema (doc 01/02-03) — the real column is the floor a value must clear,
// so 255 wins over the doc's illustrative number.
const addressedCoordinate = coordinate.extend({
  address: z.string().trim().min(3).max(255).optional(),
});

const MIN_SCHEDULE_LEAD_MINUTES = 15;

export const createRideRequestSchema = z.object({
  cityId: smallintId,
  categoryId: smallintId,
  pickup: addressedCoordinate,
  dropoff: addressedCoordinate,
  paymentIntent: z.enum(['cash', 'wallet', 'bkash', 'nagad', 'card']),
  promoCode: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()).optional(),
  womenOnly: z.boolean().default(false),
  scheduledFor: z.string().datetime({ offset: true }).refine(
    (value) => new Date(value).getTime() >= Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60_000,
    `scheduledFor must be at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes from now`,
  ).optional(),
});
