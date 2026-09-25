import { Router } from 'express';

import * as meController from '../controllers/me.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { passwordMutationLimiter, supportMutationLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  changePasswordSchema,
  createContactSchema,
  createPlaceSchema,
  deleteAccountSchema,
  driverPublicIdParamsSchema,
  idParamsSchema,
  totpCodeSchema,
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

router.get('/favorite-drivers', requireRole('PASSENGER'), meController.listFavoriteDrivers);
router.put(
  '/favorite-drivers/:driverId', requireRole('PASSENGER'),
  validate(driverPublicIdParamsSchema, 'params'), meController.addFavoriteDriver,
);
router.delete(
  '/favorite-drivers/:driverId', requireRole('PASSENGER'),
  validate(driverPublicIdParamsSchema, 'params'), meController.removeFavoriteDriver,
);

router.get('/referral', meController.getReferral);

router.delete('/', passwordMutationLimiter, validate(deleteAccountSchema), meController.deleteAccount);

router.get('/two-factor', requireRole('ADMIN'), meController.getTwoFactor);
router.post('/two-factor/setup', requireRole('ADMIN'), passwordMutationLimiter, meController.startTwoFactorSetup);
router.post('/two-factor/enable', requireRole('ADMIN'), passwordMutationLimiter, validate(totpCodeSchema), meController.enableTwoFactor);
router.post('/two-factor/disable', requireRole('ADMIN'), passwordMutationLimiter, validate(totpCodeSchema), meController.disableTwoFactor);

export default router;
