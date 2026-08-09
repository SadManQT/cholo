import { Router } from 'express';

import citiesRouter from './cities.routes.js';

const apiRouter = Router();

apiRouter.use('/cities', citiesRouter);

export default apiRouter;
