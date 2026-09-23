import { Router } from 'express';

import * as tripsController from '../controllers/trips.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { paymentMutationLimiter } from '../middlewares/rateLimit.js';
import {
  cancelTripSchema,
  completeTripSchema,
  payTripSchema,
  rateTripSchema,
  sosSchema,
  tripCodeParamsSchema,
  tripListQuerySchema,
  tripMessageSchema,
} from '../validators/trips.schema.js';

const router = Router();

router.use(auth);

router.get('/', validate(tripListQuerySchema, 'query'), tripsController.list);
router.get(
  '/:tripCode/track',
  validate(tripCodeParamsSchema, 'params'),
  tripsController.track,
);
router.get(
  '/:tripCode/messages',
  validate(tripCodeParamsSchema, 'params'),
  tripsController.listMessages,
);
router.post(
  '/:tripCode/messages',
  validate(tripCodeParamsSchema, 'params'),
  validate(tripMessageSchema),
  tripsController.sendMessage,
);
router.post(
  '/:tripCode/sos',
  validate(tripCodeParamsSchema, 'params'),
  validate(sosSchema),
  tripsController.triggerSos,
);
router.post(
  '/:tripCode/rating',
  validate(tripCodeParamsSchema, 'params'),
  validate(rateTripSchema),
  tripsController.rate,
);
router.get(
  '/:tripCode',
  validate(tripCodeParamsSchema, 'params'),
  tripsController.get,
);

router.post(
  '/:tripCode/arrived',
  requireRole('DRIVER'),
  validate(tripCodeParamsSchema, 'params'),
  tripsController.markArrived,
);
router.post(
  '/:tripCode/start',
  requireRole('DRIVER'),
  validate(tripCodeParamsSchema, 'params'),
  tripsController.markStarted,
);
router.post(
  '/:tripCode/complete',
  requireRole('DRIVER'),
  validate(tripCodeParamsSchema, 'params'),
  validate(completeTripSchema),
  tripsController.complete,
);
router.post(
  '/:tripCode/cancel',
  validate(tripCodeParamsSchema, 'params'),
  validate(cancelTripSchema),
  tripsController.cancel,
);
router.post(
  '/:tripCode/pay',
  requireRole('PASSENGER'),
  paymentMutationLimiter,
  validate(tripCodeParamsSchema, 'params'),
  validate(payTripSchema),
  tripsController.pay,
);

export default router;
