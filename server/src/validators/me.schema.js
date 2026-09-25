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

const phone = z.string().regex(/^01[3-9][0-9]{8}$/, 'Phone must be a valid Bangladeshi number, e.g. 01712345678');

const placeFields = {
  label: z.string().trim().min(1, 'Give the place a name').max(40, 'Name must be 40 characters or fewer'),
  address: z.string().trim().min(1, 'Choose an address').max(255),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
};

export const createPlaceSchema = z.object(placeFields);

export const updatePlaceSchema = z.object(placeFields).partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update.' });

export const createContactSchema = z.object({
  name: z.string().trim().min(1, 'Enter the contact\'s name').max(120),
  phone,
  relationship: z.string().trim().max(40).optional(),
});

export const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

export const driverPublicIdParamsSchema = z.object({ driverId: z.string().uuid() });

export const deleteAccountSchema = z.object({ password: z.string().min(1, 'Enter your password').max(72) });

export const totpCodeSchema = z.object({ code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code') });
