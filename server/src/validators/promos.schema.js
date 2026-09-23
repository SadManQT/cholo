import { z } from 'zod';

const smallintId = z.number().int().positive().max(32_767);

export const validatePromoSchema = z.object({
  code: z.string().trim().min(1).max(30).transform((value) => value.toUpperCase()),
  cityId: smallintId,
  categoryId: smallintId,
  estFare: z.number().positive(),
});

export const availablePromosQuerySchema = z.object({
  cityId: z.coerce.number().int().positive().max(32_767),
});
