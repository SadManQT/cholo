import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as documentsRepo from '../repositories/documents.repository.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as vehiclesRepo from '../repositories/vehicles.repository.js';
import { AppError } from '../utils/AppError.js';

const REQUIRED_DRIVER_DOCUMENTS = Object.freeze(['license', 'nid', 'photo', 'police_clearance']);
const REQUIRED_VEHICLE_DOCUMENTS = Object.freeze(['registration', 'fitness', 'insurance', 'tax_token']);

function isExpired(expiryDate) {
  return expiryDate != null && expiryDate < new Date().toISOString().slice(0, 10);
}

function hasApprovedRequiredDocuments(documents, requiredTypes) {
  const byType = new Map(documents.map((document) => [document.docType, document]));
  return requiredTypes.every((docType) => {
    const document = byType.get(docType);
    return document?.status === 'approved' && !isExpired(document.expiryDate);
  });
}

function auditContext(adminId, ipAddress) {
  return { actorId: adminId, actorRole: 'ADMIN', ipAddress };
}

export async function listDrivers(query) {
  const { status, page, limit } = query;
  const { rows, total } = await adminRepo.listDriverApplications({
    status,
    limit,
    offset: (page - 1) * limit,
  });

  return { data: rows, meta: { page, limit, total } };
}

export async function reviewDriverDocument(adminId, documentId, decision, ipAddress) {
  return withTransaction(async (client) => {
    const document = await documentsRepo.findDriverDocumentForUpdate(documentId, client);
    if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND');
    if (document.status !== 'pending') {
      throw new AppError(409, 'DOCUMENT_ALREADY_REVIEWED');
    }
    if (decision.status === 'approved' && isExpired(document.expiryDate)) {
      throw new AppError(409, 'DOCUMENT_EXPIRED');
    }

    const reviewed = await documentsRepo.reviewDriverDocument(
      documentId,
      { ...decision, reviewedBy: adminId },
      client,
    );
    await auditRepo.insert(
      {
        ...auditContext(adminId, ipAddress),
        action: decision.status === 'approved' ? 'DRIVER_DOCUMENT_APPROVED' : 'DRIVER_DOCUMENT_REJECTED',
        entityType: 'driver_documents',
        entityId: documentId,
        oldValue: { status: document.status, reviewedBy: document.reviewedBy },
        newValue: {
          status: reviewed.status,
          reviewedBy: adminId,
          reason: decision.reason ?? null,
        },
      },
      client,
    );

    return reviewed;
  });
}

export async function reviewVehicleDocument(adminId, documentId, decision, ipAddress) {
  return withTransaction(async (client) => {
    const document = await documentsRepo.findVehicleDocumentForUpdate(documentId, client);
    if (!document) throw new AppError(404, 'DOCUMENT_NOT_FOUND');
    if (document.status !== 'pending') {
      throw new AppError(409, 'DOCUMENT_ALREADY_REVIEWED');
    }
    if (decision.status === 'approved' && isExpired(document.expiryDate)) {
      throw new AppError(409, 'DOCUMENT_EXPIRED');
    }

    const reviewed = await documentsRepo.reviewVehicleDocument(
      documentId,
      { ...decision, reviewedBy: adminId },
      client,
    );
    await auditRepo.insert(
      {
        ...auditContext(adminId, ipAddress),
        action: decision.status === 'approved' ? 'VEHICLE_DOCUMENT_APPROVED' : 'VEHICLE_DOCUMENT_REJECTED',
        entityType: 'vehicle_documents',
        entityId: documentId,
        oldValue: { status: document.status, reviewedBy: document.reviewedBy },
        newValue: {
          status: reviewed.status,
          reviewedBy: adminId,
          reason: decision.reason ?? null,
        },
      },
      client,
    );

    return reviewed;
  });
}

export async function decideDriver(adminId, driverId, status, reason, ipAddress) {
  return withTransaction(async (client) => {
    const profile = await driversRepo.findProfileForUpdate(driverId, client);
    if (!profile) throw new AppError(404, 'DRIVER_NOT_FOUND');
    if (profile.verificationStatus !== 'pending') {
      throw new AppError(409, 'DRIVER_ALREADY_REVIEWED');
    }

    if (status === 'approved') {
      const documents = await documentsRepo.findLatestDriverDocuments(driverId, client);
      if (
        !hasApprovedRequiredDocuments(documents, REQUIRED_DRIVER_DOCUMENTS)
        || isExpired(profile.licenseExpiry)
      ) {
        throw new AppError(409, 'DOCS_NOT_APPROVED');
      }
    }

    const updated = await driversRepo.setVerificationStatus(
      driverId,
      { status, verifiedBy: adminId },
      client,
    );
    await auditRepo.insert(
      {
        ...auditContext(adminId, ipAddress),
        action: status === 'approved' ? 'DRIVER_APPROVED' : 'DRIVER_REJECTED',
        entityType: 'driver_profiles',
        entityId: driverId,
        oldValue: { verificationStatus: profile.verificationStatus },
        newValue: { verificationStatus: status, verifiedBy: adminId, reason: reason ?? null },
      },
      client,
    );

    return updated;
  });
}

export async function decideVehicle(adminId, vehicleId, status, reason, ipAddress) {
  return withTransaction(async (client) => {
    const vehicle = await vehiclesRepo.findForUpdate(vehicleId, client);
    if (!vehicle) throw new AppError(404, 'VEHICLE_NOT_FOUND');
    if (vehicle.verificationStatus !== 'pending') {
      throw new AppError(409, 'VEHICLE_ALREADY_REVIEWED');
    }

    if (status === 'approved') {
      const documents = await documentsRepo.findLatestVehicleDocuments(vehicleId, client);
      if (!hasApprovedRequiredDocuments(documents, REQUIRED_VEHICLE_DOCUMENTS)) {
        throw new AppError(409, 'VEHICLE_DOCS_NOT_APPROVED');
      }
    }

    const updated = await vehiclesRepo.setVerificationStatus(vehicleId, status, client);
    await auditRepo.insert(
      {
        ...auditContext(adminId, ipAddress),
        action: status === 'approved' ? 'VEHICLE_APPROVED' : 'VEHICLE_REJECTED',
        entityType: 'vehicles',
        entityId: vehicleId,
        oldValue: { verificationStatus: vehicle.verificationStatus },
        newValue: { verificationStatus: status, reason: reason ?? null },
      },
      client,
    );

    return updated;
  });
}
