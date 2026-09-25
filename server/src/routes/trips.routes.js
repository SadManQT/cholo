import { Router } from 'express';

import * as tripsController from '../controllers/trips.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { paymentMutationLimiter, supportMutationLimiter } from '../middlewares/rateLimit.js';
import {
  arrivalSchema,
  cancelTripSchema,
  completeTripSchema,
  payTripSchema,
  rateTripSchema,
  reportTripSchema,
  sosSchema,
  tripCodeParamsSchema,
  tripListQuerySchema,
  tripMessageSchema,
  tripStopParamsSchema,
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
  '/:tripCode/report',
  supportMutationLimiter,
  validate(tripCodeParamsSchema, 'params'),
  validate(reportTripSchema),
  tripsController.report,
);
router.post(
  '/:tripCode/share',
  requireRole('PASSENGER'),
  validate(tripCodeParamsSchema, 'params'),
  tripsController.share,
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
  validate(arrivalSchema),
  tripsController.markArrived,
);
router.post(
  '/:tripCode/start',
  requireRole('DRIVER'),
  validate(tripCodeParamsSchema, 'params'),
  tripsController.markStarted,
);
router.post(
  '/:tripCode/stops/:stopOrder/arrived',
  requireRole('DRIVER'),
  validate(tripStopParamsSchema, 'params'),
  validate(arrivalSchema),
  tripsController.arriveAtStop,
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
