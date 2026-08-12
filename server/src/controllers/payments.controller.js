import * as paymentsService from '../services/payments.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const get = asyncHandler(async (request, response) => {
  const data = await paymentsService.getPayment(request.user.id, request.params.publicId);
  response.json({ success: true, data });
});
