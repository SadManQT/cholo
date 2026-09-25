import { z } from 'zod';

const phoneSchema = z
  .string()
  .regex(/^01[3-9][0-9]{8}$/, 'Phone must be a valid Bangladeshi number, e.g. 01712345678');

export const registerSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your full name').max(120, 'Name must be 120 characters or fewer'),
  phone: phoneSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be 72 characters or fewer'),
  gender: z.enum(['female', 'male', 'other']).optional(),
  referralCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/, 'Referral codes are letters and numbers only').optional(),
});

export const twoFactorLoginSchema = z.object({
  challengeToken: z.string().min(20).max(2000),
  code: z.string().regex(/^[0-9]{6}$/, 'Enter the 6-digit code'),
});

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^[0-9]{6}$/, 'OTP must be 6 digits'),
  purpose: z.literal('signup'),
});

export const resendOtpSchema = z.object({
  phone: phoneSchema,
  purpose: z.literal('signup'),
});

export const loginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(72),
});

export const forgotPasswordSchema = z.object({ phone: phoneSchema });

export const verifyResetCodeSchema = z.object({
  phone: phoneSchema,
  otp: z.string().regex(/^[0-9]{6}$/, 'The code must be 6 digits'),
});

export const resetPasswordSchema = z.object({
  resetToken: z.string().min(20).max(200),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(72, 'Password must be 72 characters or fewer'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'Passwords do not match',
});
