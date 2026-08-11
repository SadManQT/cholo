import { Router } from 'express';

import * as driverController from '../controllers/driver.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import {
  applyDriverSchema,
  availabilitySchema,
  createDriverDocumentSchema,
  createVehicleDocumentSchema,
  createVehicleSchema,
  idParamsSchema,
  respondToOfferSchema,
  updateVehicleSchema,
} from '../validators/driver.schema.js';

const router = Router();

router.use(auth);
router.post('/apply', validate(applyDriverSchema), driverController.apply);

router.use(requireRole('DRIVER'));
router.get('/status', driverController.getStatus);
router.post('/documents', validate(createDriverDocumentSchema), driverController.addDocument);
router.get('/documents', driverController.listDocuments);
router.post('/vehicles', validate(createVehicleSchema), driverController.addVehicle);
router.get('/vehicles', driverController.listVehicles);
router.patch(
  '/vehicles/:id',
  validate(idParamsSchema, 'params'),
  validate(updateVehicleSchema),
  driverController.updateVehicle,
);
router.delete(
  '/vehicles/:id',
  validate(idParamsSchema, 'params'),
  driverController.deactivateVehicle,
);
router.put(
  '/vehicles/:id/activate',
  validate(idParamsSchema, 'params'),
  driverController.activateVehicle,
);
router.post(
  '/vehicles/:id/documents',
  validate(idParamsSchema, 'params'),
  validate(createVehicleDocumentSchema),
  driverController.addVehicleDocument,
);
router.get(
  '/vehicles/:id/documents',
  validate(idParamsSchema, 'params'),
  driverController.listVehicleDocuments,
);
router.put('/availability', validate(availabilitySchema), driverController.setAvailability);
router.get('/offers', driverController.listOffers);
router.post(
  '/offers/:id/respond',
  validate(idParamsSchema, 'params'),
  validate(respondToOfferSchema),
  driverController.respondToOffer,
);

export default router;
