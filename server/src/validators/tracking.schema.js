import { z } from 'zod';

// location:update's payload — same bounds as rides.schema.js's coordinate,
// plus the GPS fields driver_availability/trip_location_pings actually
// store (heading 0-360°, speed non-negative).
export const locationUpdateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).optional(),
});
