import { z } from 'zod';

export const driverQueueQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'suspended']).default('pending'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const reviewDocumentSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    reason: z.string().trim().min(1).max(255).optional(),
  })
  .refine(({ status, reason }) => status !== 'rejected' || Boolean(reason), {
    path: ['reason'],
    message: 'A rejection reason is required',
  });

export const rejectApplicationSchema = z.object({
  reason: z.string().trim().min(1).max(255),
});
