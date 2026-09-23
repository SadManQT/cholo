import { z } from 'zod';

const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const smallintId = z.number().int().positive().max(32_767);

export const quoteSchema = z.object({
  cityId: smallintId,
  categoryId: smallintId,
  pickup: coordinate,
  dropoff: coordinate,
});

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

export const rideRequestParamsSchema = z.object({
  publicId: z.string().uuid(),
});
