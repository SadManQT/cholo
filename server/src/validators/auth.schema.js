import { z } from 'zod';

// Mirrors the DB CHECK on users.phone (doc 03 §4) — same rule at both
// fences (doc 08 §8).
const phoneSchema = z
  .string()
  .regex(/^01[3-9][0-9]{8}$/, 'Phone must be a valid Bangladeshi number, e.g. 01712345678');

export const registerSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  phone: phoneSchema,
  password: z.string().min(8).max(72),
  gender: z.enum(['female', 'male', 'other']).optional(),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
  purpose: z.literal('signup'),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(72),
});
