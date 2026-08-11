import { z } from 'zod';

export const geocodeQuerySchema = z.object({
  query: z.string().trim().min(3).max(160),
});

export const reverseGeocodeQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
});
