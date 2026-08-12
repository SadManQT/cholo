import express, { Router } from 'express';

import * as webhooksController from '../controllers/webhooks.controller.js';
import { validate } from '../middlewares/validate.js';
import { webhookGatewayParamsSchema } from '../validators/payments.schema.js';

const router = Router();

// No `auth` — doc 09 §7's own auth column for this route is "signature",
// not bearer. SSLCommerz's IPN POST body is application/x-www-form-
// urlencoded, not JSON — app.js only wires up express.json() globally,
// so this route needs its own parser or request.body would be empty.
router.post(
  '/payments/:gateway',
  express.urlencoded({ extended: true }),
  validate(webhookGatewayParamsSchema, 'params'),
  webhooksController.paymentWebhook,
);

export default router;
