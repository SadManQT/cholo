import { z } from 'zod';

export const walletTransactionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// doc 08-09-10 §7's POST /wallet/topup. 10.00 floor matches SSLCommerz's
// own real Session API minimum (total_amount 10.00–500000.00 BDT) — a
// smaller request would fail at the gateway anyway, so reject it here
// with a clear TOPUP_AMOUNT_OUT_OF_RANGE instead of a confusing gateway
// error. 25,000 ceiling is an app-side guardrail, not the gateway's own.
export const topupSchema = z.object({
  amount: z.number().min(10).max(25_000),
  method: z.enum(['bkash', 'nagad', 'card']),
});
