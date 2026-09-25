import QRCode from 'qrcode';

import { withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as placesRepo from '../repositories/places.repository.js';
import * as socialRepo from '../repositories/social.repository.js';
import * as rolesRepo from '../repositories/roles.repository.js';
import * as sessionsRepo from '../repositories/sessions.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import { AppError } from '../utils/AppError.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from '../utils/totp.js';
import { REFERRAL_BONUS } from './referrals.service.js';

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

export const listFavoriteDrivers = (userId) => socialRepo.listFavoriteDrivers(userId);

export async function addFavoriteDriver(userId, driverPublicId) {
  const driverId = await socialRepo.findRiddenDriverId(userId, driverPublicId);
  if (!driverId) throw new AppError(422, 'FAVORITE_NOT_ALLOWED');
  await socialRepo.addFavoriteDriver(userId, driverId);
}

export const removeFavoriteDriver = (userId, driverPublicId) => socialRepo.removeFavoriteDriver(userId, driverPublicId);

export async function getReferral(userId) {
  const summary = await socialRepo.getReferralSummary(userId);
  return { ...summary, bonus: REFERRAL_BONUS };
}

/**
 * Deleting keeps trips, payments and ratings (accounting and the other party's history need them) but
 * anonymises the person and ends every session. Money left in the wallet is not paid out automatically.
 */
export async function deleteAccount(userId, { password }) {
  const user = await usersRepo.findPasswordHashById(userId);
  if (!await verifyPassword(password, user?.passwordHash)) throw new AppError(401, 'CURRENT_PASSWORD_INVALID');

  await withTransaction(async (client) => {
    const { rows } = await client.query(
      `SELECT
         EXISTS (SELECT 1 FROM trips WHERE (passenger_id = $1 OR driver_id = $1)
                 AND status IN ('assigned', 'arrived', 'in_progress')) AS "activeTrip",
         EXISTS (SELECT 1 FROM withdrawals WHERE driver_id = $1
                 AND status IN ('requested', 'approved', 'processing')) AS "pendingWithdrawal"`,
      [userId],
    );
    if (rows[0].activeTrip) throw new AppError(409, 'ACTIVE_TRIP_EXISTS');
    if (rows[0].pendingWithdrawal) throw new AppError(409, 'PENDING_WITHDRAWAL_EXISTS');

    await client.query(
      `UPDATE ride_requests SET status = 'cancelled', cancelled_at = now()
       WHERE passenger_id = $1 AND status IN ('pending', 'searching')`,
      [userId],
    );
    await client.query(`UPDATE driver_availability SET status = 'offline' WHERE driver_id = $1`, [userId]);
    await usersRepo.anonymise(userId, client);
    await sessionsRepo.revokeActiveForUser(userId, client);
    await sessionsRepo.endAllSessionsForUser(userId, client);
  });
}

async function requireAdminTwoFactor(userId) {
  const twoFactor = await adminRepo.getTwoFactor(userId);
  if (!twoFactor) throw new AppError(403, 'FORBIDDEN_ROLE');
  return twoFactor;
}

export async function getTwoFactorStatus(userId) {
  const twoFactor = await requireAdminTwoFactor(userId);
  return { enabled: Boolean(twoFactor.enabledAt), enabledAt: twoFactor.enabledAt ?? null };
}

/** Starts (or restarts) setup: a fresh secret that only takes effect once a code from it is confirmed. */
export async function startTwoFactorSetup(userId) {
  const twoFactor = await requireAdminTwoFactor(userId);
  if (twoFactor.enabledAt) throw new AppError(409, 'TOTP_ALREADY_ENABLED');
  const secret = generateTotpSecret();
  await adminRepo.setTwoFactor(userId, { secret, enabledAt: null });
  const user = await usersRepo.findById(userId);
  const url = otpauthUrl(secret, user.phone);
  return { secret, otpauthUrl: url, qrDataUrl: await QRCode.toDataURL(url, { margin: 1, width: 220 }) };
}

export async function enableTwoFactor(userId, { code }) {
  const twoFactor = await requireAdminTwoFactor(userId);
  if (twoFactor.enabledAt) throw new AppError(409, 'TOTP_ALREADY_ENABLED');
  if (!twoFactor.secret) throw new AppError(409, 'TOTP_NOT_SET_UP');
  if (!verifyTotp(twoFactor.secret, code)) throw new AppError(422, 'TOTP_INVALID');
  await adminRepo.setTwoFactor(userId, { secret: twoFactor.secret, enabledAt: new Date() });
  return { enabled: true };
}

export async function disableTwoFactor(userId, { code }) {
  const twoFactor = await requireAdminTwoFactor(userId);
  if (!twoFactor.enabledAt) return { enabled: false };
  if (!verifyTotp(twoFactor.secret, code)) throw new AppError(422, 'TOTP_INVALID');
  await adminRepo.setTwoFactor(userId, { secret: null, enabledAt: null });
  return { enabled: false };
}
