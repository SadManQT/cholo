import { Router } from 'express';

import * as adminController from '../controllers/admin.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  driverQueueQuerySchema,
  rejectApplicationSchema,
  reviewDocumentSchema,
  withdrawalQueueQuerySchema,
} from '../validators/admin.schema.js';
import { idParamsSchema } from '../validators/driver.schema.js';

const router = Router();

router.use(auth, requireRole('ADMIN'));
router.get('/drivers', validate(driverQueueQuerySchema, 'query'), adminController.listDrivers);
router.post(
  '/documents/:id/review',
  validate(idParamsSchema, 'params'),
  validate(reviewDocumentSchema),
  adminController.reviewDriverDocument,
);
router.post(
  '/vehicle-documents/:id/review',
  validate(idParamsSchema, 'params'),
  validate(reviewDocumentSchema),
  adminController.reviewVehicleDocument,
);
router.post(
  '/drivers/:id/approve',
  validate(idParamsSchema, 'params'),
  adminController.approveDriver,
);
router.post(
  '/drivers/:id/reject',
  validate(idParamsSchema, 'params'),
  validate(rejectApplicationSchema),
  adminController.rejectDriver,
);
router.post(
  '/vehicles/:id/approve',
  validate(idParamsSchema, 'params'),
  adminController.approveVehicle,
);
router.post(
  '/vehicles/:id/reject',
  validate(idParamsSchema, 'params'),
  validate(rejectApplicationSchema),
  adminController.rejectVehicle,
);

// doc 08-09-10 §9: role ADMIN gets in the door (requireRole above);
// access_level ('finance') is re-checked inside withdrawals.service.js —
// it lives in admin_profiles, not the JWT, so it can't be a route-level
// middleware the way requireRole is (doc 10 §9 layer 1 vs layer 2).
router.get(
  '/withdrawals',
  validate(withdrawalQueueQuerySchema, 'query'),
  adminController.listWithdrawalQueue,
);
router.post(
  '/withdrawals/:id/approve',
  validate(idParamsSchema, 'params'),
  adminController.approveWithdrawal,
);
router.post(
  '/withdrawals/:id/reject',
  validate(idParamsSchema, 'params'),
  validate(rejectApplicationSchema),
  adminController.rejectWithdrawal,
);

export default router;
