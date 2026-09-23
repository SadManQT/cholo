import { Router } from 'express';

import * as vehicleCategoriesController from '../controllers/vehicleCategories.controller.js';

const router = Router();

router.get('/', vehicleCategoriesController.list);

export default router;
