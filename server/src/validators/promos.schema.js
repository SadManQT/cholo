import { z } from 'zod';

const smallintId = z.number().int().positive().max(32_767);

// Mirrors createRideRequestSchema's promoCode rule exactly (rides.schema.
// js) — same trim/uppercase/length shape, since this previews the very
// same code a booking would submit.
export const validatePromoSchema = z.object({
  code: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  cityId: smallintId,
  categoryId: smallintId,
  estFare: z.number().positive(),
});

export const availablePromosQuerySchema = z.object({
  cityId: z.coerce.number().int().positive().max(32_767),
});
