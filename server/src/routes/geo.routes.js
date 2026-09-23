import { Router } from 'express';

import * as geoController from '../controllers/geo.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { geoSearchLimiter } from '../middlewares/rateLimit.js';
import { geocodeQuerySchema, reverseGeocodeQuerySchema, routeSchema } from '../validators/geo.schema.js';

const router = Router();

router.use(auth);
router.post('/route', validate(routeSchema), geoController.route);
router.use(requireRole('PASSENGER'));
router.get('/geocode', validate(geocodeQuerySchema, 'query'), geoController.geocode);
router.get('/search', geoSearchLimiter, validate(geocodeQuerySchema, 'query'), geoController.search);
router.get('/reverse', validate(reverseGeocodeQuerySchema, 'query'), geoController.reverseGeocode);

export default router;
