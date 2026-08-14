import { z } from 'zod';

export const createDisputeSchema = z.object({
  tripPublicId: z.string().regex(/^JT-\d{4}-\d{6}$/, 'Invalid trip code'),
  disputeType: z.enum(['fare_overcharge', 'payment_failed', 'behavior', 'lost_item', 'service_quality']),
  description: z.string().trim().min(5).max(3000),
  disputedAmount: z.coerce.number().positive().optional(),
});

export const disputeListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
