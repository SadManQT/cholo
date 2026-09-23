import { Router } from 'express';

import * as notificationsController from '../controllers/notifications.controller.js';
import { auth } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { markReadSchema, notificationListQuerySchema } from '../validators/notifications.schema.js';

const router = Router();
router.use(auth);
router.get('/', validate(notificationListQuerySchema, 'query'), notificationsController.list);
router.post('/read', validate(markReadSchema), notificationsController.markRead);

export default router;
