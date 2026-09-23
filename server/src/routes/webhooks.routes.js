import express, { Router } from 'express';

import * as webhooksController from '../controllers/webhooks.controller.js';
import { validate } from '../middlewares/validate.js';
import { webhookGatewayParamsSchema } from '../validators/payments.schema.js';

const router = Router();

router.post(
  '/payments/:gateway',
  express.urlencoded({ extended: true }),
  validate(webhookGatewayParamsSchema, 'params'),
  webhooksController.paymentWebhook,
);

export default router;
