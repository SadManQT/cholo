import { z } from 'zod';

export const paymentPublicIdParamsSchema = z.object({
  publicId: z.string().uuid(),
});

export const webhookGatewayParamsSchema = z.object({
  gateway: z.string().min(1),
});
