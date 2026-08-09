import { Router } from 'express';

import authRouter from './auth.routes.js';
import citiesRouter from './cities.routes.js';
import meRouter from './me.routes.js';

const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/cities', citiesRouter);
apiRouter.use('/me', meRouter);

export default apiRouter;
