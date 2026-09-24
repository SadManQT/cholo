import { z } from 'zod';

export const paymentPublicIdParamsSchema = z.object({
  publicId: z.string().uuid(),
});

export const paymentReturnQuerySchema = z.object({
  result: z.enum(['success', 'fail', 'cancel']),
});

export const webhookGatewayParamsSchema = z.object({
  gateway: z.string().min(1),
});
