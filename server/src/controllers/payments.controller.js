import * as paymentsService from '../services/payments.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const gatewayReturn = asyncHandler(async (request, response) => {
  const target = await paymentsService.handleReturn(request.params.publicId, request.query.result, request.body);
  response.redirect(303, target);
});

export const get = asyncHandler(async (request, response) => {
  const data = await paymentsService.getPayment(request.user.id, request.params.publicId);
  response.json({ success: true, data });
});
