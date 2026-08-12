import { pool } from '../config/db.js';

// admin_profiles.access_level (doc 08-09-10 §9: "a second dimension...
// checked in services") — never in the JWT (roles are; access_level
// isn't), so every access-level-gated action needs this DB read.
export async function getAccessLevel(userId, client = pool) {
  const { rows } = await client.query(
    `SELECT access_level AS "accessLevel" FROM admin_profiles WHERE user_id = $1`,
    [userId],
  );

  return rows[0]?.accessLevel;
}

export async function listDriverApplications({ status, limit, offset }, client = pool) {
  const { rows } = await client.query(
    `WITH latest_documents AS (
       SELECT DISTINCT ON (driver_id, doc_type)
              id, driver_id, doc_type, status, expiry_date, uploaded_at
       FROM driver_documents
       ORDER BY driver_id, doc_type, uploaded_at DESC, id DESC
     )
     SELECT dp.user_id AS id, u.public_id AS "publicId",
            u.full_name AS "fullName", u.phone,
            dp.nid_number AS "nidNumber", dp.license_number AS "licenseNumber",
            dp.license_expiry::text AS "licenseExpiry",
            dp.verification_status AS "verificationStatus",
            dp.created_at AS "appliedAt",
            COUNT(*) OVER()::int AS "totalCount",
            COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', ld.id,
                  'docType', ld.doc_type,
                  'status', ld.status,
                  'expiryDate', ld.expiry_date
                ) ORDER BY ld.doc_type
              ) FILTER (WHERE ld.id IS NOT NULL),
              '[]'::jsonb
            ) AS documents
     FROM driver_profiles dp
     JOIN users u ON u.id = dp.user_id
     LEFT JOIN latest_documents ld ON ld.driver_id = dp.user_id
     WHERE dp.verification_status = $1
     GROUP BY dp.user_id, u.public_id, u.full_name, u.phone,
              dp.nid_number, dp.license_number, dp.license_expiry,
              dp.verification_status, dp.created_at
     ORDER BY dp.created_at ASC, dp.user_id ASC
     LIMIT $2 OFFSET $3`,
    [status, limit, offset],
  );

  const total = rows[0]?.totalCount ?? 0;
  return {
    rows: rows.map(({ totalCount: _totalCount, ...row }) => row),
    total,
  };
}
