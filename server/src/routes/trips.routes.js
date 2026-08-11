import { Router } from 'express';

import * as tripsController from '../controllers/trips.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { cancelTripSchema, completeTripSchema, tripCodeParamsSchema } from '../validators/trips.schema.js';

const router = Router();

// Only `auth` at the router level — cancel is doc 08-09-10 §5's
// "participant" (either the passenger or the driver on the trip), unlike
// the other three which are DRIVER-only. Role gate on those three moves to
// each route individually; ownership gate (404 TRIP_NOT_FOUND on mismatch)
// stays inside trips.service.js either way.
router.use(auth);

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

export default router;
