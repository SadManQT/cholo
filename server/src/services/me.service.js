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
  // Unique violation on email becomes 409 DUPLICATE via the central
  // errorHandler (doc 08 §9) — same pattern as register's phone check.
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

  // doc 10 §8: revoke every OTHER session — this one just proved it knows
  // the current password, so it's allowed to keep running.
  await sessionsRepo.revokeActiveForUserExceptSession(userId, sessionId);
  await sessionsRepo.endAllSessionsForUserExceptSession(userId, sessionId);
}
