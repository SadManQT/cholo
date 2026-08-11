import { Router } from 'express';

import * as ridesController from '../controllers/rides.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { createRideRequestSchema, rideRequestParamsSchema } from '../validators/rides.schema.js';

// Mounted at /ride-requests, NOT under /rides — doc 08-09-10 §5's endpoint
// table lists `/rides/quote` (an action) but `/ride-requests` as its own
// top-level resource collection (§4: "resources are plural nouns"). Same
// rides.controller.js/rides.service.js either way — this is a routing
// prefix split, not a different feature.
const router = Router();

router.use(auth, requireRole('PASSENGER'));
router.post('/', validate(createRideRequestSchema), ridesController.createRequest);
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
