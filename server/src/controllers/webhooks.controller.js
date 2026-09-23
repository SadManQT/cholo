import * as paymentsService from '../services/payments.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const paymentWebhook = asyncHandler(async (request, response) => {
  await paymentsService.handleWebhook(request.params.gateway, request.body);
  response.status(200).json({ received: true });
});
