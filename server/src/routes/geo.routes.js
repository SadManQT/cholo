import { Router } from 'express';

import * as geoController from '../controllers/geo.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { geocodeQuerySchema, reverseGeocodeQuerySchema } from '../validators/geo.schema.js';

const router = Router();

router.use(auth, requireRole('PASSENGER'));
router.get('/geocode', validate(geocodeQuerySchema, 'query'), geoController.geocode);
router.get('/reverse', validate(reverseGeocodeQuerySchema, 'query'), geoController.reverseGeocode);

export default router;
