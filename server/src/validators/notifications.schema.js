import { z } from 'zod';

export const notificationListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export const markReadSchema = z.object({
  ids: z.array(z.coerce.number().int().positive()).min(1).max(100).optional(),
});
