import { Router } from 'express';

import * as ridesController from '../controllers/rides.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { bookingLimiter } from '../middlewares/rateLimit.js';
import { createRideRequestSchema, rideRequestParamsSchema } from '../validators/rides.schema.js';

const router = Router();

router.use(auth, requireRole('PASSENGER'));
router.post('/', bookingLimiter, validate(createRideRequestSchema), ridesController.createRequest);
router.get(
  '/:publicId',
  validate(rideRequestParamsSchema, 'params'),
  ridesController.getRequest,
);
router.delete(
  '/:publicId',
  validate(rideRequestParamsSchema, 'params'),
  ridesController.cancelRequest,
);

export default router;
