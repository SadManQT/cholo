import { Router } from 'express';

import * as tripsController from '../controllers/trips.controller.js';
import { shareViewLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { shareTokenParamsSchema } from '../validators/trips.schema.js';

// Public: family members open a rider's share link without an account.
const router = Router();

router.get('/:token', shareViewLimiter, validate(shareTokenParamsSchema, 'params'), tripsController.viewShared);

export default router;
