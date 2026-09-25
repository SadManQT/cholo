import { z } from 'zod';

const coordinate = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const smallintId = z.number().int().positive().max(32_767);

const addressedCoordinate = coordinate.extend({
  address: z.string().trim().min(3).max(255).optional(),
});

const MAX_STOPS = 2;
const stopsList = z.array(addressedCoordinate).max(MAX_STOPS, `Add at most ${MAX_STOPS} stops`).default([]);

export const quoteSchema = z.object({
  cityId: smallintId,
  categoryId: smallintId,
  pickup: coordinate,
  dropoff: coordinate,
  stops: stopsList,
});

const MIN_SCHEDULE_LEAD_MINUTES = 15;
const MAX_SCHEDULE_DAYS = 7;

export const createRideRequestSchema = z.object({
  cityId: smallintId,
  categoryId: smallintId,
  pickup: addressedCoordinate,
  dropoff: addressedCoordinate,
  stops: stopsList,
  paymentIntent: z.enum(['cash', 'wallet', 'bkash', 'nagad', 'card']),
  promoCode: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()).optional(),
  womenOnly: z.boolean().default(false),
  scheduledFor: z.string().datetime({ offset: true }).refine(
    (value) => new Date(value).getTime() >= Date.now() + MIN_SCHEDULE_LEAD_MINUTES * 60_000,
    `Schedule at least ${MIN_SCHEDULE_LEAD_MINUTES} minutes ahead`,
  ).refine(
    (value) => new Date(value).getTime() <= Date.now() + MAX_SCHEDULE_DAYS * 86_400_000,
    `Schedule at most ${MAX_SCHEDULE_DAYS} days ahead`,
  ).optional(),
});

export const rideRequestParamsSchema = z.object({
  publicId: z.string().uuid(),
});
