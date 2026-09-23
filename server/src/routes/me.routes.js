import { Router } from 'express';

import * as meController from '../controllers/me.controller.js';
import { auth } from '../middlewares/auth.js';
import { passwordMutationLimiter, supportMutationLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  createContactSchema,
  createPlaceSchema,
  idParamsSchema,
  updateMeSchema,
  updatePlaceSchema,
} from '../validators/me.schema.js';

const router = Router();

router.use(auth);

router.get('/', meController.getMe);
router.patch('/', validate(updateMeSchema), meController.updateMe);
router.patch('/password', passwordMutationLimiter, validate(changePasswordSchema), meController.changePassword);

router.get('/places', meController.listPlaces);
router.post('/places', supportMutationLimiter, validate(createPlaceSchema), meController.addPlace);
router.patch('/places/:id', validate(idParamsSchema, 'params'), validate(updatePlaceSchema), meController.updatePlace);
router.delete('/places/:id', validate(idParamsSchema, 'params'), meController.removePlace);

router.get('/emergency-contacts', meController.listContacts);
router.post('/emergency-contacts', supportMutationLimiter, validate(createContactSchema), meController.addContact);
router.delete('/emergency-contacts/:id', validate(idParamsSchema, 'params'), meController.removeContact);

export default router;
