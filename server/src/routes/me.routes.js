import { Router } from 'express';

import * as meController from '../controllers/me.controller.js';
import { auth } from '../middlewares/auth.js';
import { passwordMutationLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import { changePasswordSchema, updateMeSchema } from '../validators/me.schema.js';

const router = Router();

router.use(auth);

router.get('/', meController.getMe);
router.patch('/', validate(updateMeSchema), meController.updateMe);
router.patch('/password', passwordMutationLimiter, validate(changePasswordSchema), meController.changePassword);

export default router;
