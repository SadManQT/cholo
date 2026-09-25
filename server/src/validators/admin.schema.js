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

export const suspendUserSchema = userDecisionSchema.extend({
  duration: z.enum(['permanent', '1w', '1m', 'custom']).default('permanent'),
  until: z.iso.datetime({ offset: true }).optional(),
}).refine(({ duration, until }) => duration !== 'custom' || (until && new Date(until) > new Date()), {
  path: ['until'],
  message: 'Choose an end date in the future',
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

const zonePoint = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) });
const zoneFields = {
  name: z.string().trim().min(2, 'Name the zone').max(80),
  zoneType: z.enum(['regular', 'airport', 'station', 'restricted']),
  points: z.array(zonePoint).min(3, 'Draw at least 3 points on the map').max(200),
  isActive: z.boolean(),
};

export const createZoneSchema = z.object({
  cityId: z.number().int().positive(),
  ...zoneFields,
  isActive: zoneFields.isActive.default(true),
});

export const updateZoneSchema = z.object(zoneFields).partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update.' });

export const zoneListQuerySchema = z.object({ cityId: z.coerce.number().int().positive().optional() });

const promoFields = {
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,30}$/, 'Use 3–30 letters, numbers, - or _'),
  description: z.string().trim().max(255).optional(),
  promoType: z.enum(['percentage', 'fixed_amount']),
  value: z.number().positive(),
  maxDiscount: z.number().positive().nullable().optional(),
  minFare: z.number().nonnegative().nullable().optional(),
  usageLimitTotal: z.number().int().positive().nullable().optional(),
  usageLimitPerUser: z.number().int().positive().max(32_767).nullable().optional(),
  firstRideOnly: z.boolean().optional(),
  cityId: z.coerce.number().int().positive().nullable().optional(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  validFrom: z.string().datetime({ offset: true }),
  validUntil: z.string().datetime({ offset: true }).nullable().optional(),
  isActive: z.boolean().optional(),
};

const promoRules = (data, context) => {
  if (data.promoType === 'percentage' && data.value > 100) {
    context.addIssue({ code: 'custom', path: ['value'], message: 'A percentage can be at most 100' });
  }
  if (data.validFrom && data.validUntil && new Date(data.validUntil) <= new Date(data.validFrom)) {
    context.addIssue({ code: 'custom', path: ['validUntil'], message: 'End must be after start' });
  }
};

export const createPromoSchema = z.object({ ...promoFields, notifyRiders: z.boolean().default(false) })
  .superRefine(promoRules);

export const updatePromoSchema = z.object(promoFields).partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'Provide at least one field to update.' })
  .superRefine(promoRules);

export const promoListQuerySchema = z.object(paginationFields);

export const surgeListQuerySchema = z.object({
  includeEnded: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  ...paginationFields,
});

export const createSurgeSchema = z.object({
  zoneId: z.coerce.number().int().positive(),
  categoryId: z.coerce.number().int().positive().nullable().optional(),
  multiplier: z.number().min(1.1, 'Surge starts at 1.1×').max(3, 'Surge is capped at 3×'),
  reason: z.enum(['demand', 'weather', 'event', 'peak_hour']),
  startsAt: z.string().datetime({ offset: true }).optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
}).refine((data) => !data.endsAt || new Date(data.endsAt) > new Date(data.startsAt ?? Date.now()), {
  path: ['endsAt'], message: 'End must be after start',
});

export const reportQueueQuerySchema = z.object({
  status: z.enum(['open', 'investigating', 'action_taken', 'dismissed']).optional(),
  ...paginationFields,
});

export const updateReportSchema = z.object({
  status: z.enum(['investigating', 'action_taken', 'dismissed']),
  note: z.string().trim().max(500).optional(),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const exportParamsSchema = z.object({ kind: z.enum(['trips', 'payments', 'withdrawals']) });

export const exportQuerySchema = z.object({ from: isoDate, to: isoDate })
  .refine((data) => data.from <= data.to, { path: ['to'], message: 'End date must be on or after the start' })
  .refine((data) => (new Date(data.to) - new Date(data.from)) / 86_400_000 <= 366, {
    path: ['to'], message: 'Export at most one year at a time',
  });
