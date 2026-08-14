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

// doc 08-09-10 §9: GET /admin/withdrawals?status=requested — the finance
// queue. status optional (omitted = every status, newest-requested-first
// via the repository's own ORDER BY), same shape as driverQueueQuerySchema.
export const withdrawalQueueQuerySchema = z.object({
  status: z.enum(['requested', 'approved', 'processing', 'paid', 'rejected', 'failed']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const paginationFields = {
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
};

export const statsQuerySchema = z.object({
  cityId: z.coerce.number().int().positive().optional(),
});

export const userListQuerySchema = z.object({
  search: z.string().trim().max(120).default(''),
  status: z.enum(['active', 'suspended', 'deleted']).optional(),
  ...paginationFields,
});

export const userDecisionSchema = z.object({
  reason: z.string().trim().min(3).max(255),
});

export const pricingRulesQuerySchema = z.object({
  cityId: z.coerce.number().int().positive().optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  ...paginationFields,
});

export const publishPricingRuleSchema = z
  .object({
    cityId: z.coerce.number().int().positive(),
    categoryId: z.coerce.number().int().positive(),
    baseFare: z.coerce.number().nonnegative(),
    perKmRate: z.coerce.number().nonnegative(),
    perMinRate: z.coerce.number().nonnegative(),
    minimumFare: z.coerce.number().nonnegative(),
    bookingFee: z.coerce.number().nonnegative().default(0),
    waitingPerMin: z.coerce.number().nonnegative().default(0),
    freeWaitMinutes: z.coerce.number().int().nonnegative().default(0),
    cancellationFee: z.coerce.number().nonnegative().default(0),
    effectiveFrom: z.string().datetime({ offset: true }),
    effectiveTo: z.string().datetime({ offset: true }).optional(),
  })
  .refine(
    ({ effectiveFrom, effectiveTo }) => !effectiveTo || new Date(effectiveTo) > new Date(effectiveFrom),
    { path: ['effectiveTo'], message: 'effectiveTo must be later than effectiveFrom' },
  );

export const vehicleQueueQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  ...paginationFields,
});

export const disputeQueueQuerySchema = z.object({
  status: z.enum(['open', 'under_review', 'resolved_refunded', 'resolved_no_action', 'rejected']).optional(),
  ...paginationFields,
});

export const resolveDisputeSchema = z
  .object({
    status: z.enum(['resolved_refunded', 'resolved_no_action', 'rejected']),
    resolutionNote: z.string().trim().min(3).max(1000),
    refundAmount: z.coerce.number().positive().optional(),
  })
  .refine(({ status, refundAmount }) => status !== 'resolved_refunded' || refundAmount != null, {
    path: ['refundAmount'],
    message: 'refundAmount is required for a refunded dispute',
  })
  .refine(({ status, refundAmount }) => status === 'resolved_refunded' || refundAmount == null, {
    path: ['refundAmount'],
    message: 'refundAmount is only valid for a refunded dispute',
  });

export const sosQueueQuerySchema = z.object({
  status: z.enum(['active', 'acknowledged', 'resolved', 'false_alarm']).optional(),
  ...paginationFields,
});

export const resolveSosSchema = z.object({
  status: z.enum(['resolved', 'false_alarm']).default('resolved'),
  resolutionNote: z.string().trim().min(3).max(255),
});

export const auditLogQuerySchema = z.object({
  entityType: z.string().trim().max(60).optional(),
  actorId: z.coerce.number().int().positive().optional(),
  action: z.string().trim().max(80).optional(),
  ...paginationFields,
});

export const supportQueueQuerySchema = z.object({
  status: z.enum(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  ...paginationFields,
});

export const updateSupportTicketSchema = z
  .object({
    status: z.enum(['open', 'in_progress', 'waiting_user', 'resolved', 'closed']).optional(),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    assignedToMe: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide a ticket change');
