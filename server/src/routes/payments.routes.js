import { Router } from 'express';

import * as paymentsController from '../controllers/payments.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { paymentPublicIdParamsSchema } from '../validators/payments.schema.js';

const router = Router();

router.use(auth);

router.get('/:publicId', validate(paymentPublicIdParamsSchema, 'params'), paymentsController.get);

export default router;
