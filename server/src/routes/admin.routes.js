import { Router } from 'express';

import * as adminController from '../controllers/admin.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { validate } from '../middlewares/validate.js';
import { adminMutationLimiter } from '../middlewares/rateLimit.js';
import {
  auditLogQuerySchema,
  disputeQueueQuerySchema,
  driverQueueQuerySchema,
  pricingRulesQuerySchema,
  publishPricingRuleSchema,
  rejectApplicationSchema,
  resolveDisputeSchema,
  resolveSosSchema,
  reviewDocumentSchema,
  sosQueueQuerySchema,
  statsQuerySchema,
  supportQueueQuerySchema,
  updateSupportTicketSchema,
  userDecisionSchema,
  userListQuerySchema,
  vehicleQueueQuerySchema,
  withdrawalQueueQuerySchema,
} from '../validators/admin.schema.js';
import { idParamsSchema } from '../validators/driver.schema.js';
import { ticketMessageSchema } from '../validators/support.schema.js';

const router = Router();

router.use(auth, requireRole('ADMIN'));
router.get('/stats', validate(statsQuerySchema, 'query'), adminController.getStats);
router.get('/drivers', validate(driverQueueQuerySchema, 'query'), adminController.listDrivers);
router.get('/vehicles', validate(vehicleQueueQuerySchema, 'query'), adminController.listVehicles);
router.post(
  '/documents/:id/review',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  validate(reviewDocumentSchema),
  adminController.reviewDriverDocument,
);
router.post(
  '/vehicle-documents/:id/review',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  validate(reviewDocumentSchema),
  adminController.reviewVehicleDocument,
);
router.post(
  '/drivers/:id/approve',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  adminController.approveDriver,
);
router.post(
  '/drivers/:id/reject',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  validate(rejectApplicationSchema),
  adminController.rejectDriver,
);
router.post(
  '/vehicles/:id/approve',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  adminController.approveVehicle,
);
router.post(
  '/vehicles/:id/reject',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  validate(rejectApplicationSchema),
  adminController.rejectVehicle,
);

// doc 08-09-10 §9: role ADMIN gets in the door (requireRole above);
// access_level ('finance') is re-checked inside withdrawals.service.js —
// it lives in admin_profiles, not the JWT, so it can't be a route-level
// middleware the way requireRole is (doc 10 §9 layer 1 vs layer 2).
router.get(
  '/withdrawals',
  validate(withdrawalQueueQuerySchema, 'query'),
  adminController.listWithdrawalQueue,
);
router.post(
  '/withdrawals/:id/approve',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  adminController.approveWithdrawal,
);
router.post(
  '/withdrawals/:id/reject',
  adminMutationLimiter,
  validate(idParamsSchema, 'params'),
  validate(rejectApplicationSchema),
  adminController.rejectWithdrawal,
);

router.get('/users', validate(userListQuerySchema, 'query'), adminController.listUsers);
router.post(
  '/users/:id/suspend', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(userDecisionSchema), adminController.suspendUser,
);
router.post(
  '/users/:id/reinstate', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(userDecisionSchema), adminController.reinstateUser,
);

router.get('/pricing-rules', validate(pricingRulesQuerySchema, 'query'), adminController.listPricingRules);
router.post(
  '/pricing-rules', adminMutationLimiter, validate(publishPricingRuleSchema), adminController.publishPricingRule,
);

router.get('/disputes', validate(disputeQueueQuerySchema, 'query'), adminController.listDisputes);
router.post(
  '/disputes/:id/resolve', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(resolveDisputeSchema), adminController.resolveDispute,
);

router.get('/sos', validate(sosQueueQuerySchema, 'query'), adminController.listSos);
router.post(
  '/sos/:id/acknowledge', adminMutationLimiter,
  validate(idParamsSchema, 'params'), adminController.acknowledgeSos,
);
router.post(
  '/sos/:id/resolve', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(resolveSosSchema), adminController.resolveSos,
);

router.get('/audit-logs', validate(auditLogQuerySchema, 'query'), adminController.listAuditLogs);

router.get('/support/tickets', validate(supportQueueQuerySchema, 'query'), adminController.listSupportTickets);
router.get('/support/tickets/:id', validate(idParamsSchema, 'params'), adminController.getSupportTicket);
router.patch(
  '/support/tickets/:id', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(updateSupportTicketSchema), adminController.updateSupportTicket,
);
router.post(
  '/support/tickets/:id/messages', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(ticketMessageSchema), adminController.addSupportMessage,
);

export default router;
