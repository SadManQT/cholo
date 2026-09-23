import { z } from 'zod';

export const walletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const topupSchema = z.object({
  amount: z.number().min(10).max(25_000),
  method: z.enum(['bkash', 'nagad', 'card']),
});
