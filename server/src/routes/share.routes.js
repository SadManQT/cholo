import { Router } from 'express';

import * as tripsController from '../controllers/trips.controller.js';
import { shareViewLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { shareTokenParamsSchema } from '../validators/trips.schema.js';

const router = Router();

router.get('/:token', shareViewLimiter, validate(shareTokenParamsSchema, 'params'), tripsController.viewShared);

export default router;
