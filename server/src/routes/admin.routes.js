import { Router } from 'express';

import * as adminController from '../controllers/admin.controller.js';
import * as marketplaceController from '../controllers/marketplace.controller.js';
import { auth, requireRole } from '../middlewares/auth.js';
import { signPrivateFiles } from '../middlewares/signPrivateFiles.js';
import { validate } from '../middlewares/validate.js';
import { adminMutationLimiter } from '../middlewares/rateLimit.js';
import {
  auditLogQuerySchema,
  createPromoSchema,
  createSurgeSchema,
  exportParamsSchema,
  exportQuerySchema,
  promoListQuerySchema,
  reportQueueQuerySchema,
  surgeListQuerySchema,
  updatePromoSchema,
  updateReportSchema,
  disputeQueueQuerySchema,
  driverQueueQuerySchema,
  pricingRulesQuerySchema,
  publishPricingRuleSchema,
  rejectApplicationSchema,
  resolveDisputeSchema,
  resolveSosSchema,
  reviewDocumentSchema,
  sosQueueQuerySchema,
  suspendUserSchema,
  createZoneSchema,
  updateZoneSchema,
  zoneListQuerySchema,
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
router.use(signPrivateFiles);
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
  validate(idParamsSchema, 'params'), validate(suspendUserSchema), adminController.suspendUser,
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

router.post(
  '/disputes/:id/review', adminMutationLimiter,
  validate(idParamsSchema, 'params'), adminController.startDisputeReview,
);

router.get('/zones', validate(zoneListQuerySchema, 'query'), adminController.listZones);
router.post('/zones', adminMutationLimiter, validate(createZoneSchema), adminController.createZone);
router.patch(
  '/zones/:id', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(updateZoneSchema), adminController.updateZone,
);
router.delete('/zones/:id', adminMutationLimiter, validate(idParamsSchema, 'params'), adminController.deleteZone);

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

router.get('/promos', validate(promoListQuerySchema, 'query'), marketplaceController.listPromos);
router.post('/promos', adminMutationLimiter, validate(createPromoSchema), marketplaceController.createPromo);
router.patch(
  '/promos/:id', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(updatePromoSchema), marketplaceController.updatePromo,
);

router.get('/surge', validate(surgeListQuerySchema, 'query'), marketplaceController.listSurge);
router.post('/surge', adminMutationLimiter, validate(createSurgeSchema), marketplaceController.createSurge);
router.post(
  '/surge/:id/end', adminMutationLimiter, validate(idParamsSchema, 'params'), marketplaceController.endSurge,
);

router.get('/reports', validate(reportQueueQuerySchema, 'query'), marketplaceController.listReports);
router.patch(
  '/reports/:id', adminMutationLimiter,
  validate(idParamsSchema, 'params'), validate(updateReportSchema), marketplaceController.updateReport,
);

router.get(
  '/exports/:kind.csv',
  validate(exportParamsSchema, 'params'), validate(exportQuerySchema, 'query'), marketplaceController.exportCsv,
);

export default router;
