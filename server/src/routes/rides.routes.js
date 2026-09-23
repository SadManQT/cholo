import { Router } from 'express';

import * as ridesController from '../controllers/rides.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { quoteSchema } from '../validators/rides.schema.js';

const router = Router();

router.use(auth, requireRole('PASSENGER'));
router.post('/quote', validate(quoteSchema), ridesController.quote);

export default router;
