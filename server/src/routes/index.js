import { Router } from 'express';

import adminRouter from './admin.routes.js';
import authRouter from './auth.routes.js';
import citiesRouter from './cities.routes.js';
import driverRouter from './driver.routes.js';
import geoRouter from './geo.routes.js';
import meRouter from './me.routes.js';
import rideRequestsRouter from './rideRequests.routes.js';
import ridesRouter from './rides.routes.js';
import tripsRouter from './trips.routes.js';
import vehicleCategoriesRouter from './vehicleCategories.routes.js';

const apiRouter = Router();

apiRouter.use('/admin', adminRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/cities', citiesRouter);
apiRouter.use('/driver', driverRouter);
apiRouter.use('/geo', geoRouter);
apiRouter.use('/me', meRouter);
apiRouter.use('/ride-requests', rideRequestsRouter);
apiRouter.use('/rides', ridesRouter);
apiRouter.use('/trips', tripsRouter);
apiRouter.use('/vehicle-categories', vehicleCategoriesRouter);

export default apiRouter;
