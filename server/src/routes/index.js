import { Router } from 'express';

import adminRouter from './admin.routes.js';
import authRouter from './auth.routes.js';
import citiesRouter from './cities.routes.js';
import driverRouter from './driver.routes.js';
import meRouter from './me.routes.js';

const apiRouter = Router();

apiRouter.use('/admin', adminRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/cities', citiesRouter);
apiRouter.use('/driver', driverRouter);
apiRouter.use('/me', meRouter);

export default apiRouter;
