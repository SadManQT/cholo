import express, { Router } from 'express';

import * as paymentsController from '../controllers/payments.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { paymentPublicIdParamsSchema, paymentReturnQuerySchema } from '../validators/payments.schema.js';

const router = Router();

router.all(
  '/:publicId/return',
  express.urlencoded({ extended: true }),
  validate(paymentPublicIdParamsSchema, 'params'),
  validate(paymentReturnQuerySchema, 'query'),
  paymentsController.gatewayReturn,
);

router.use(auth);

router.get('/:publicId', validate(paymentPublicIdParamsSchema, 'params'), paymentsController.get);

export default router;
