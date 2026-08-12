import { Router } from 'express';

import * as promosController from '../controllers/promos.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { availablePromosQuerySchema, validatePromoSchema } from '../validators/promos.schema.js';

const router = Router();

// doc 08-09-10 §7: both routes are "bearer" only, not role-restricted —
// unlike /rides/quote (PASSENGER-only), a promo preview has no side
// effects worth gating by role.
router.use(auth);

router.post('/validate', validate(validatePromoSchema), promosController.validate);
router.get('/available', validate(availablePromosQuerySchema, 'query'), promosController.listAvailable);

export default router;
