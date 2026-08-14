import { z } from 'zod';

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

export const geocodeQuerySchema = z.object({
  query: z.string().trim().min(3).max(160),
});

export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});

export const routeSchema = z.object({
  pickup: coordinateSchema,
  dropoff: coordinateSchema,
});
