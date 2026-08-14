import { Router } from 'express';

import adminRouter from './admin.routes.js';
import authRouter from './auth.routes.js';
import citiesRouter from './cities.routes.js';
import driverRouter from './driver.routes.js';
import disputesRouter from './disputes.routes.js';
import geoRouter from './geo.routes.js';
import meRouter from './me.routes.js';
import paymentsRouter from './payments.routes.js';
import promosRouter from './promos.routes.js';
import rideRequestsRouter from './rideRequests.routes.js';
import ridesRouter from './rides.routes.js';
import supportRouter from './support.routes.js';
import tripsRouter from './trips.routes.js';
import vehicleCategoriesRouter from './vehicleCategories.routes.js';
import walletRouter from './wallet.routes.js';
import webhooksRouter from './webhooks.routes.js';

const apiRouter = Router();

apiRouter.use('/admin', adminRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/cities', citiesRouter);
apiRouter.use('/driver', driverRouter);
apiRouter.use('/disputes', disputesRouter);
apiRouter.use('/geo', geoRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/payments', paymentsRouter);
apiRouter.use('/promos', promosRouter);
apiRouter.use('/ride-requests', rideRequestsRouter);
apiRouter.use('/rides', ridesRouter);
apiRouter.use('/support', supportRouter);
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/vehicle-categories', vehicleCategoriesRouter);
apiRouter.use('/wallet', walletRouter);
apiRouter.use('/webhooks', webhooksRouter);

export default apiRouter;
