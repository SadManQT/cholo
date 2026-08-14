import { z } from 'zod';

const tripCode = z.string().regex(/^JT-\d{4}-\d{6}$/, 'Invalid trip code');

export const ticketListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createTicketSchema = z.object({
  category: z.enum(['payment', 'ride', 'account', 'driver_conduct', 'app_issue', 'other']),
  subject: z.string().trim().min(3).max(150),
  description: z.string().trim().min(5).max(3000),
  tripId: tripCode.optional(),
});

export const ticketParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const ticketMessageSchema = z.object({
  body: z.string().trim().min(1).max(3000),
  attachmentUrl: z.string().url().max(2048).optional(),
  isInternalNote: z.boolean().default(false),
});
