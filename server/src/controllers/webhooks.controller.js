import * as paymentsService from '../services/payments.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

// Always 200 once we've genuinely processed the request (doc 08-09-10
// §10.4: "200 always after processing") — handleWebhook itself is what
// throws 401 BAD_SIGNATURE for anything that fails verification, via the
// same AppError path every other route uses; a settled:false result
// (nothing to do — already processed, or the gateway itself reported a
// failed/cancelled attempt) is still a 200, not an error.
export const paymentWebhook = asyncHandler(async (request, response) => {
  await paymentsService.handleWebhook(request.params.gateway, request.body);
  response.status(200).json({ received: true });
});
