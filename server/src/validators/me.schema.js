import { z } from 'zod';

export const updateMeSchema = z
  .object({
    fullName: z.string().trim().min(1).max(120).optional(),
    email: z.string().trim().toLowerCase().email().max(255).optional(),
    photoUrl: z.string().url().max(2048).optional(),
    preferredLanguage: z.enum(['bn', 'en']).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Provide at least one field to update.',
  });

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72),
});
