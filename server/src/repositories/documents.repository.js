import { pool } from '../config/db.js';

const DRIVER_DOCUMENT_SELECT = `
  id, driver_id AS "driverId", doc_type AS "docType",
  doc_number AS "docNumber", file_url AS "fileUrl",
  issue_date::text AS "issueDate", expiry_date::text AS "expiryDate",
  status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
  rejection_reason AS "rejectionReason", uploaded_at AS "uploadedAt"`;

const VEHICLE_DOCUMENT_SELECT = `
  vd.id, vd.vehicle_id AS "vehicleId", vd.doc_type AS "docType",
  vd.doc_number AS "docNumber", vd.file_url AS "fileUrl",
  vd.issue_date::text AS "issueDate", vd.expiry_date::text AS "expiryDate",
  vd.status, vd.reviewed_by AS "reviewedBy", vd.reviewed_at AS "reviewedAt",
  vd.uploaded_at AS "uploadedAt"`;

const VEHICLE_DOCUMENT_RETURNING = `
  id, vehicle_id AS "vehicleId", doc_type AS "docType",
  doc_number AS "docNumber", file_url AS "fileUrl",
  issue_date::text AS "issueDate", expiry_date::text AS "expiryDate",
  status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
  uploaded_at AS "uploadedAt"`;

export async function insertDriverDocument(
  { driverId, docType, docNumber, fileUrl, issueDate, expiryDate },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO driver_documents
       (driver_id, doc_type, doc_number, file_url, issue_date, expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${DRIVER_DOCUMENT_SELECT}`,
    [driverId, docType, docNumber ?? null, fileUrl, issueDate ?? null, expiryDate ?? null],
  );

  return rows[0];
}

export async function listDriverDocuments(driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${DRIVER_DOCUMENT_SELECT}
     FROM driver_documents
     WHERE driver_id = $1
     ORDER BY uploaded_at DESC, id DESC`,
    [driverId],
  );

  return rows;
}

export async function findLatestDriverDocuments(driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT DISTINCT ON (doc_type)
            id, doc_type AS "docType", status, expiry_date::text AS "expiryDate"
     FROM driver_documents
     WHERE driver_id = $1
     ORDER BY doc_type, uploaded_at DESC, id DESC`,
    [driverId],
  );

  return rows;
}

export async function findDriverDocumentForUpdate(documentId, client) {
  const { rows } = await client.query(
    `SELECT ${DRIVER_DOCUMENT_SELECT}
     FROM driver_documents
     WHERE id = $1
     FOR UPDATE`,
    [documentId],
  );

  return rows[0];
}

export async function reviewDriverDocument(
  documentId,
  { status, reviewedBy, reason },
  client = pool,
) {
  const { rows } = await client.query(
    `UPDATE driver_documents
     SET status = $2, reviewed_by = $3, reviewed_at = now(),
         rejection_reason = $4
     WHERE id = $1
     RETURNING ${DRIVER_DOCUMENT_SELECT}`,
    [documentId, status, reviewedBy, status === 'rejected' ? reason : null],
  );

  return rows[0];
}

export async function insertVehicleDocument(
  { vehicleId, docType, docNumber, fileUrl, issueDate, expiryDate },
  client = pool,
) {
  const { rows } = await client.query(
    `INSERT INTO vehicle_documents
       (vehicle_id, doc_type, doc_number, file_url, issue_date, expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING ${VEHICLE_DOCUMENT_RETURNING}`,
    [vehicleId, docType, docNumber ?? null, fileUrl, issueDate ?? null, expiryDate ?? null],
  );

  return rows[0];
}

export async function listVehicleDocumentsForDriver(vehicleId, driverId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${VEHICLE_DOCUMENT_SELECT}
     FROM vehicle_documents vd
     JOIN vehicles v ON v.id = vd.vehicle_id
     WHERE vd.vehicle_id = $1 AND v.driver_id = $2
     ORDER BY vd.uploaded_at DESC, vd.id DESC`,
    [vehicleId, driverId],
  );

  return rows;
}

export async function findLatestVehicleDocuments(vehicleId, client = pool) {
  const { rows } = await client.query(
    `SELECT DISTINCT ON (doc_type)
            id, doc_type AS "docType", status, expiry_date::text AS "expiryDate"
     FROM vehicle_documents
     WHERE vehicle_id = $1
     ORDER BY doc_type, uploaded_at DESC, id DESC`,
    [vehicleId],
  );

  return rows;
}

export async function findVehicleDocumentForUpdate(documentId, client) {
  const { rows } = await client.query(
    `SELECT ${VEHICLE_DOCUMENT_SELECT}
     FROM vehicle_documents vd
     WHERE vd.id = $1
     FOR UPDATE`,
    [documentId],
  );

  return rows[0];
}

export async function reviewVehicleDocument(
  documentId,
  { status, reviewedBy },
  client = pool,
) {
  const { rows } = await client.query(
    `UPDATE vehicle_documents
     SET status = $2, reviewed_by = $3, reviewed_at = now()
     WHERE id = $1
     RETURNING ${VEHICLE_DOCUMENT_RETURNING}`,
    [documentId, status, reviewedBy],
  );

  return rows[0];
}
