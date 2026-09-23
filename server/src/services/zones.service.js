import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as auditRepo from '../repositories/audit.repository.js';
import * as zonesRepo from '../repositories/zones.repository.js';
import { AppError } from '../utils/AppError.js';

async function requireZoneAdmin(adminId, client) {
  const level = await adminRepo.getAccessLevel(adminId, client);
  if (!['super', 'ops'].includes(level)) throw new AppError(403, 'FORBIDDEN_ACCESS_LEVEL');
}

// Admins draw an open ring of points; GeoJSON wants it closed, as [lng, lat] pairs.
function toPolygon(points) {
  if (!points) return undefined;
  const ring = points.map(({ lat, lng }) => [lng, lat]);
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

function uniqueName(error) {
  if (error.code === '23505') throw new AppError(409, 'ZONE_NAME_TAKEN');
  throw error;
}

export const listZones = (query) => zonesRepo.list(query);

export async function createZone(adminId, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireZoneAdmin(adminId, client);
    const id = await zonesRepo.insert({ ...input, boundary: toPolygon(input.points) }, client).catch(uniqueName);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress, action: 'ZONE_CREATED', entityType: 'zones', entityId: id,
      oldValue: null, newValue: { name: input.name, zoneType: input.zoneType, cityId: input.cityId },
    }, client);
    return zonesRepo.findById(id, client);
  });
}

export async function updateZone(adminId, id, input, ipAddress) {
  return withTransaction(async (client) => {
    await requireZoneAdmin(adminId, client);
    const zone = await zonesRepo.findForUpdate(id, client);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND');
    await zonesRepo.update(id, { ...input, boundary: toPolygon(input.points) }, client).catch(uniqueName);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress, action: 'ZONE_UPDATED', entityType: 'zones', entityId: id,
      oldValue: zone, newValue: { ...input, points: input.points ? `${input.points.length} points` : undefined },
    }, client);
    return zonesRepo.findById(id, client);
  });
}

export async function deleteZone(adminId, id, ipAddress) {
  await withTransaction(async (client) => {
    await requireZoneAdmin(adminId, client);
    const zone = await zonesRepo.findForUpdate(id, client);
    if (!zone) throw new AppError(404, 'ZONE_NOT_FOUND');
    await zonesRepo.remove(id, client);
    await auditRepo.insert({
      actorId: adminId, actorRole: 'ADMIN', ipAddress, action: 'ZONE_DELETED', entityType: 'zones', entityId: id,
      oldValue: zone, newValue: null,
    }, client);
  });
}

export async function assertBookable(cityId, pickup, dropoff) {
  const [blocked] = await zonesRepo.findRestrictedAt(cityId, pickup, dropoff);
  if (blocked) {
    throw new AppError(422, 'RESTRICTED_ZONE', [
      { field: blocked.coversPickup ? 'pickup' : 'dropoff', issue: `${blocked.name} is a restricted area. Choose a point outside it.` },
    ]);
  }
}
