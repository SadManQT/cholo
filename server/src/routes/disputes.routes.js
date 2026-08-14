import { Router } from 'express';

import * as disputesController from '../controllers/disputes.controller.js';
import { auth } from '../middlewares/auth.js';
import { disputeLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { createDisputeSchema, disputeListQuerySchema } from '../validators/disputes.schema.js';

const router = Router();
router.use(auth);
router.post('/', disputeLimiter, validate(createDisputeSchema), disputesController.create);
router.get('/', validate(disputeListQuerySchema, 'query'), disputesController.list);

export default router;
