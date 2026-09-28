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
  vd.rejection_reason AS "rejectionReason", vd.uploaded_at AS "uploadedAt"`;

const VEHICLE_DOCUMENT_RETURNING = `
  id, vehicle_id AS "vehicleId", doc_type AS "docType",
  doc_number AS "docNumber", file_url AS "fileUrl",
  issue_date::text AS "issueDate", expiry_date::text AS "expiryDate",
  status, reviewed_by AS "reviewedBy", reviewed_at AS "reviewedAt",
  rejection_reason AS "rejectionReason", uploaded_at AS "uploadedAt"`;

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

// Editing: while the newest copy of a document type is still waiting for review, a resubmission replaces
// it in place (same row, fresh upload time) instead of piling up versions. A null field keeps its value.
export async function updatePendingDriverDocument(
  { driverId, docType, docNumber, fileUrl, issueDate, expiryDate },
  client = pool,
) {
  const { rows } = await client.query(
    `UPDATE driver_documents
     SET file_url = COALESCE($3, file_url), doc_number = COALESCE($4, doc_number),
         issue_date = COALESCE($5, issue_date), expiry_date = COALESCE($6, expiry_date), uploaded_at = now()
     WHERE status = 'pending'
       AND id = (SELECT id FROM driver_documents
                 WHERE driver_id = $1 AND doc_type = $2
                 ORDER BY uploaded_at DESC, id DESC LIMIT 1)
     RETURNING ${DRIVER_DOCUMENT_SELECT}`,
    [driverId, docType, fileUrl ?? null, docNumber ?? null, issueDate ?? null, expiryDate ?? null],
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

export async function updatePendingVehicleDocument(
  { vehicleId, docType, docNumber, fileUrl, issueDate, expiryDate },
  client = pool,
) {
  const { rows } = await client.query(
    `UPDATE vehicle_documents
     SET file_url = COALESCE($3, file_url), doc_number = COALESCE($4, doc_number),
         issue_date = COALESCE($5, issue_date), expiry_date = COALESCE($6, expiry_date), uploaded_at = now()
     WHERE status = 'pending'
       AND id = (SELECT id FROM vehicle_documents
                 WHERE vehicle_id = $1 AND doc_type = $2
                 ORDER BY uploaded_at DESC, id DESC LIMIT 1)
     RETURNING ${VEHICLE_DOCUMENT_RETURNING}`,
    [vehicleId, docType, fileUrl ?? null, docNumber ?? null, issueDate ?? null, expiryDate ?? null],
  );

  return rows[0];
}

/** Every document whose newest copy is waiting for review, for any driver or active vehicle, oldest first. */
export async function listPendingForReview(client = pool) {
  const { rows } = await client.query(
    `WITH latest_driver AS (
       SELECT DISTINCT ON (driver_id, doc_type) *
       FROM driver_documents
       ORDER BY driver_id, doc_type, uploaded_at DESC, id DESC
     ), latest_vehicle AS (
       SELECT DISTINCT ON (vehicle_id, doc_type) *
       FROM vehicle_documents
       ORDER BY vehicle_id, doc_type, uploaded_at DESC, id DESC
     )
     SELECT d.id, false AS vehicle, d.doc_type::text AS "docType", d.status, d.expiry_date::text AS "expiryDate",
            d.file_url AS "fileUrl", d.doc_number AS "docNumber", d.rejection_reason AS "rejectionReason",
            d.uploaded_at AS "uploadedAt", u.full_name AS owner, u.phone AS detail
     FROM latest_driver d
     JOIN users u ON u.id = d.driver_id
     WHERE d.status = 'pending'
     UNION ALL
     SELECT d.id, true, d.doc_type::text, d.status, d.expiry_date::text,
            d.file_url, d.doc_number, d.rejection_reason,
            d.uploaded_at, u.full_name, v.registration_no
     FROM latest_vehicle d
     JOIN vehicles v ON v.id = d.vehicle_id AND v.is_active
     JOIN users u ON u.id = v.driver_id
     WHERE d.status = 'pending'
     ORDER BY "uploadedAt", id`,
  );

  return rows;
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
  { status, reviewedBy, reason },
  client = pool,
) {
  const { rows } = await client.query(
    `UPDATE vehicle_documents
     SET status = $2, reviewed_by = $3, reviewed_at = now(), rejection_reason = $4
     WHERE id = $1
     RETURNING ${VEHICLE_DOCUMENT_RETURNING}`,
    [documentId, status, reviewedBy, status === 'rejected' ? reason : null],
  );

  return rows[0];
}

/** Flips approved documents past their expiry date to 'expired' and returns who owns them. */
export async function expireLapsedDocuments(client = pool) {
  const { rows } = await client.query(
    `WITH driver_docs AS (
       UPDATE driver_documents SET status = 'expired'
       WHERE status = 'approved' AND expiry_date < CURRENT_DATE
       RETURNING driver_id, doc_type::text
     ), vehicle_docs AS (
       UPDATE vehicle_documents vd SET status = 'expired'
       FROM vehicles v
       WHERE v.id = vd.vehicle_id AND vd.status = 'approved' AND vd.expiry_date < CURRENT_DATE
       RETURNING v.driver_id, vd.doc_type::text
     )
     SELECT driver_id AS "driverId", doc_type AS "docType" FROM driver_docs
     UNION ALL SELECT driver_id, doc_type FROM vehicle_docs`,
  );
  return rows;
}

/** Approved documents that expire exactly `days` from today — the job runs daily, so each is warned once. */
export async function findExpiringOn(days, client = pool) {
  const { rows } = await client.query(
    `SELECT driver_id AS "driverId", doc_type::text AS "docType", expiry_date::text AS "expiryDate"
     FROM driver_documents WHERE status = 'approved' AND expiry_date = CURRENT_DATE + $1::int
     UNION ALL
     SELECT v.driver_id, vd.doc_type::text, vd.expiry_date::text
     FROM vehicle_documents vd JOIN vehicles v ON v.id = vd.vehicle_id
     WHERE vd.status = 'approved' AND vd.expiry_date = CURRENT_DATE + $1::int`,
    [days],
  );
  return rows;
}
