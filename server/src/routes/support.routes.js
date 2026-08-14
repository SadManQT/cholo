import { Router } from 'express';

import * as supportController from '../controllers/support.controller.js';
import { auth } from '../middlewares/auth.js';
import { supportMutationLimiter } from '../middlewares/rateLimit.js';
import { validate } from '../middlewares/validate.js';
import {
  createTicketSchema,
  ticketListQuerySchema,
  ticketMessageSchema,
  ticketParamsSchema,
} from '../validators/support.schema.js';

const router = Router();
router.use(auth);
router.post('/tickets', supportMutationLimiter, validate(createTicketSchema), supportController.create);
router.get('/tickets', validate(ticketListQuerySchema, 'query'), supportController.list);
router.get('/tickets/:id', validate(ticketParamsSchema, 'params'), supportController.get);
router.post(
  '/tickets/:id/messages', supportMutationLimiter,
  validate(ticketParamsSchema, 'params'), validate(ticketMessageSchema.omit({ isInternalNote: true })),
  supportController.addMessage,
);

export default router;
