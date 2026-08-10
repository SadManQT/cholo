import { withTransaction } from '../config/db.js';
import * as documentsRepo from '../repositories/documents.repository.js';
import * as driversRepo from '../repositories/drivers.repository.js';
import * as rolesRepo from '../repositories/roles.repository.js';
import * as vehiclesRepo from '../repositories/vehicles.repository.js';
import { AppError } from '../utils/AppError.js';

function requireDriver(value) {
  if (!value) throw new AppError(404, 'DRIVER_NOT_FOUND');
  return value;
}

function requireVehicle(value) {
  if (!value) throw new AppError(404, 'VEHICLE_NOT_FOUND');
  return value;
}

export async function apply(userId, application) {
  try {
    return await withTransaction(async (client) => {
      const state = await driversRepo.findApplicationState(userId, client);

      if (!state?.phoneVerifiedAt) {
        throw new AppError(409, 'PHONE_NOT_VERIFIED');
      }
      if (state.driverId) {
        throw new AppError(409, 'ALREADY_DRIVER');
      }

      const profile = await driversRepo.insertProfile({ userId, ...application }, client);
      const driverRoleId = await rolesRepo.findIdByName('DRIVER', client);

      if (!driverRoleId) {
        throw new Error('DRIVER role is not seeded — run database/seeds/seed.reference.sql');
      }

      await rolesRepo.assignRole(userId, driverRoleId, client);
      return profile;
    });
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'driver_profiles_pkey') {
      throw new AppError(409, 'ALREADY_DRIVER');
    }
    throw error;
  }
}

export async function getStatus(userId) {
  const profile = requireDriver(await driversRepo.findStatusByUserId(userId));
  const documents = await documentsRepo.listDriverDocuments(userId);
  const {
    activeVehicleId,
    activeVehicleRegistrationNo,
    activeVehicleVerificationStatus,
    ...driverProfile
  } = profile;

  return {
    ...driverProfile,
    activeVehicle: activeVehicleId
      ? {
          id: activeVehicleId,
          registrationNo: activeVehicleRegistrationNo,
          verificationStatus: activeVehicleVerificationStatus,
        }
      : null,
    documents,
  };
}

export async function addDriverDocument(userId, input) {
  return withTransaction(async (client) => {
    requireDriver(await driversRepo.findProfileForUpdate(userId, client));
    const document = await documentsRepo.insertDriverDocument(
      { driverId: userId, ...input },
      client,
    );
    await driversRepo.resetRejectedToPending(userId, client);
    return document;
  });
}

export async function listDriverDocuments(userId) {
  requireDriver(await driversRepo.findStatusByUserId(userId));
  return documentsRepo.listDriverDocuments(userId);
}

export async function addVehicle(userId, input) {
  return withTransaction(async (client) => {
    requireDriver(await driversRepo.findProfileForUpdate(userId, client));

    const category = await vehiclesRepo.findActiveCategory(input.categoryId, client);
    if (!category) throw new AppError(422, 'VEHICLE_CATEGORY_NOT_FOUND');

    const vehicleId = await vehiclesRepo.insert({ driverId: userId, ...input }, client);
    return vehiclesRepo.findByIdForDriver(vehicleId, userId, client);
  });
}

export async function listVehicles(userId) {
  requireDriver(await driversRepo.findStatusByUserId(userId));
  return vehiclesRepo.listForDriver(userId);
}

export async function updateVehicle(userId, vehicleId, fields) {
  const updated = await vehiclesRepo.update(vehicleId, userId, fields);
  if (!updated) throw new AppError(404, 'VEHICLE_NOT_FOUND');
  return vehiclesRepo.findByIdForDriver(vehicleId, userId);
}

export async function deactivateVehicle(userId, vehicleId) {
  return withTransaction(async (client) => {
    const vehicle = requireVehicle(await vehiclesRepo.findForUpdate(vehicleId, client));
    if (Number(vehicle.driverId) !== userId) throw new AppError(404, 'VEHICLE_NOT_FOUND');

    const availability = requireDriver(await driversRepo.findAvailabilityForUpdate(userId, client));
    if (availability.status === 'on_trip') throw new AppError(409, 'ON_TRIP');

    await vehiclesRepo.deactivate(vehicleId, userId, client);
  });
}

export async function activateVehicle(userId, vehicleId) {
  return withTransaction(async (client) => {
    const vehicle = requireVehicle(await vehiclesRepo.findForUpdate(vehicleId, client));
    if (Number(vehicle.driverId) !== userId || !vehicle.isActive) {
      throw new AppError(404, 'VEHICLE_NOT_FOUND');
    }
    if (vehicle.verificationStatus !== 'approved') {
      throw new AppError(409, 'VEHICLE_NOT_APPROVED');
    }

    const availability = requireDriver(await driversRepo.findAvailabilityForUpdate(userId, client));
    if (availability.status === 'on_trip') throw new AppError(409, 'ON_TRIP');

    await vehiclesRepo.activate(vehicleId, userId, client);
    return vehiclesRepo.findByIdForDriver(vehicleId, userId, client);
  });
}

export async function addVehicleDocument(userId, vehicleId, input) {
  return withTransaction(async (client) => {
    const vehicle = requireVehicle(await vehiclesRepo.findForUpdate(vehicleId, client));
    if (Number(vehicle.driverId) !== userId || !vehicle.isActive) {
      throw new AppError(404, 'VEHICLE_NOT_FOUND');
    }

    const document = await documentsRepo.insertVehicleDocument(
      { vehicleId, ...input },
      client,
    );
    await vehiclesRepo.resetRejectedToPending(vehicleId, client);
    return document;
  });
}

export async function listVehicleDocuments(userId, vehicleId) {
  requireVehicle(await vehiclesRepo.findByIdForDriver(vehicleId, userId));
  return documentsRepo.listVehicleDocumentsForDriver(vehicleId, userId);
}

export async function setAvailability(userId, input) {
  return withTransaction(async (client) => {
    const current = requireDriver(await driversRepo.findAvailabilityForUpdate(userId, client));

    if (current.status === 'on_trip') throw new AppError(409, 'ON_TRIP');

    if (input.status === 'online' || input.status === 'break') {
      if (current.driverVerificationStatus !== 'approved') {
        throw new AppError(409, 'DOCS_NOT_APPROVED');
      }
      if (!current.activeVehicleId) {
        throw new AppError(409, 'ACTIVE_VEHICLE_REQUIRED');
      }
      if (current.vehicleVerificationStatus !== 'approved' || !current.vehicleIsActive) {
        throw new AppError(409, 'VEHICLE_NOT_APPROVED');
      }
    }

    if (
      input.status === 'online'
      && input.currentLat === undefined
      && (current.currentLat == null || current.currentLng == null)
    ) {
      throw new AppError(409, 'LOCATION_REQUIRED');
    }

    return driversRepo.updateAvailability(userId, input, client);
  });
}
