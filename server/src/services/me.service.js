import * as placesRepo from '../repositories/places.repository.js';
import * as rolesRepo from '../repositories/roles.repository.js';
import * as sessionsRepo from '../repositories/sessions.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';

function toMeResponse(user, roles) {
  return {
    id: user.publicId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email ?? null,
    gender: user.gender ?? null,
    dateOfBirth: user.dateOfBirth ?? null,
    photoUrl: user.photoUrl ?? null,
    preferredLanguage: user.preferredLanguage,
    phoneVerifiedAt: user.phoneVerifiedAt ?? null,
    createdAt: user.createdAt,
    roles,
    wallet: { balance: user.walletBalance, currency: user.walletCurrency },
  };
}

export async function getMe(userId) {
  const [user, roles] = await Promise.all([
    usersRepo.findMeById(userId),
    rolesRepo.findRoleNamesForUser(userId),
  ]);

  return toMeResponse(user, roles);
}

export async function updateMe(userId, fields) {
  await usersRepo.updateProfile(userId, fields);
  return getMe(userId);
}

export async function changePassword(userId, sessionId, { currentPassword, newPassword }) {
  const user = await usersRepo.findPasswordHashById(userId);
  const currentMatches = await verifyPassword(currentPassword, user?.passwordHash);

  if (!currentMatches) {
    throw new AppError(401, 'CURRENT_PASSWORD_INVALID');
  }

  const newPasswordHash = await hashPassword(newPassword);
  await usersRepo.updatePasswordHash(userId, newPasswordHash);

  await sessionsRepo.revokeActiveForUserExceptSession(userId, sessionId);
  await sessionsRepo.endAllSessionsForUserExceptSession(userId, sessionId);
}

const MAX_SAVED_PLACES = 10;
const MAX_EMERGENCY_CONTACTS = 5;

function uniqueViolation(code) {
  return (error) => {
    if (error.code === '23505') throw new AppError(409, code);
    throw error;
  };
}

export async function listPlaces(userId) {
  const [saved, recent] = await Promise.all([placesRepo.listSaved(userId), placesRepo.listRecent(userId, 5)]);
  return { saved, recent };
}

export async function addPlace(userId, input) {
  if (await placesRepo.countSaved(userId) >= MAX_SAVED_PLACES) throw new AppError(409, 'PLACE_LIMIT_REACHED');
  return placesRepo.insertSaved(userId, input).catch(uniqueViolation('PLACE_LABEL_TAKEN'));
}

export async function updatePlace(userId, id, input) {
  const place = await placesRepo.updateSaved(userId, id, input).catch(uniqueViolation('PLACE_LABEL_TAKEN'));
  if (!place) throw new AppError(404, 'PLACE_NOT_FOUND');
  return place;
}

export async function removePlace(userId, id) {
  if (!await placesRepo.deleteSaved(userId, id)) throw new AppError(404, 'PLACE_NOT_FOUND');
}

export const listContacts = (userId) => placesRepo.listContacts(userId);

export async function addContact(userId, input) {
  if ((await placesRepo.listContacts(userId)).length >= MAX_EMERGENCY_CONTACTS) {
    throw new AppError(409, 'CONTACT_LIMIT_REACHED');
  }
  return placesRepo.insertContact(userId, input).catch(uniqueViolation('CONTACT_EXISTS'));
}

export async function removeContact(userId, id) {
  if (!await placesRepo.deleteContact(userId, id)) throw new AppError(404, 'CONTACT_NOT_FOUND');
}
