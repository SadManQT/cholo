import { Router } from 'express';

import * as geoController from '../controllers/geo.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { geocodeQuerySchema, reverseGeocodeQuerySchema, routeSchema } from '../validators/geo.schema.js';

const router = Router();

router.use(auth);
// Both apps render trip directions. Address search remains passenger-only,
// while this stateless route lookup is available to any authenticated trip
// participant (ownership still gates the trip data that supplies its pins).
router.post('/route', validate(routeSchema), geoController.route);
router.use(requireRole('PASSENGER'));
router.get('/geocode', validate(geocodeQuerySchema, 'query'), geoController.geocode);
router.get('/reverse', validate(reverseGeocodeQuerySchema, 'query'), geoController.reverseGeocode);

export default router;
