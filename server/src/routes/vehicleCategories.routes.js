import { Router } from 'express';

import * as vehicleCategoriesController from '../controllers/vehicleCategories.controller.js';

const router = Router();

// Public reference data, like /cities. A guest can render the product
// catalog without receiving any private marketplace state.
router.get('/', vehicleCategoriesController.list);

export default router;
