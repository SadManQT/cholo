import { pool, withTransaction } from '../config/db.js';
import * as adminRepo from '../repositories/admin.repository.js';
import * as otpRepo from '../repositories/otp.repository.js';
import * as passengersRepo from '../repositories/passengers.repository.js';
import * as passwordResetsRepo from '../repositories/passwordResets.repository.js';
import * as rolesRepo from '../repositories/roles.repository.js';
import * as sessionsRepo from '../repositories/sessions.repository.js';
import * as socialRepo from '../repositories/social.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import { AppError } from '../utils/AppError.js';
import { OTP_MAX_ATTEMPTS, generateOtp, hashOtp, otpExpiresAt } from '../utils/otp.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { signScoped, verifyScoped } from '../utils/scopedTokens.js';
import { verifyTotp } from '../utils/totp.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from '../utils/tokens.js';
import { sendOtpSms } from './sms.service.js';

const RESET_TOKEN_TTL_MINUTES = 15;

export function suspendedError(user) {
  return new AppError(403, 'ACCOUNT_SUSPENDED', {
    reason: user.suspensionReason ?? null,
    until: user.suspendedUntil ?? null,
  });
}

function toPublicUser(user, roles) {
  return {
    id: user.publicId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email ?? null,
    roles,
  };
}

async function mintSession(userId, device) {
  const roles = await rolesRepo.findRoleNamesForUser(userId);
  const sessionId = await sessionsRepo.createSession({
    userId,
    deviceType: device.deviceType,
    deviceName: device.deviceName,
    ipAddress: device.ipAddress,
    userAgent: device.userAgent,
  });

  const accessToken = signAccessToken({ userId, roles, sessionId });
  const refreshToken = generateRefreshToken();

  await sessionsRepo.createRefreshToken({
    userId,
    sessionId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiresAt(),
  });

  const user = await usersRepo.findById(userId);
  return { accessToken, refreshToken, user: toPublicUser(user, roles) };
}

export async function register({ fullName, phone, password, gender, referralCode }) {
  const passwordHash = await hashPassword(password);
  const otp = generateOtp();

  // One transaction: a failure part-way must not leave a phone number taken by an account that can't log in.
  const user = await withTransaction(async (client) => {
    const created = await usersRepo.insert({ fullName, phone, passwordHash, gender }, client).catch((error) => {
      if (error.code === '23505') throw new AppError(409, 'PHONE_TAKEN');
      throw error;
    });

    const passengerRoleId = await rolesRepo.findIdByName('PASSENGER', client);
    if (!passengerRoleId) {
      throw new Error('PASSENGER role is not seeded — run database/seeds/seed.reference.sql');
    }
    await rolesRepo.assignRole(created.id, passengerRoleId, client);
    await passengersRepo.insertProfile(created.id, client);
    if (referralCode) {
      const referrerId = await socialRepo.findUserIdByReferralCode(referralCode, client);
      if (!referrerId) throw new AppError(422, 'REFERRAL_CODE_INVALID');
      await socialRepo.insertReferral({ referrerId, refereeId: created.id, code: referralCode }, client);
    }
    await otpRepo.insert({
      userId: created.id,
      phone,
      otpHash: hashOtp(otp),
      purpose: 'signup',
      expiresAt: otpExpiresAt(),
    }, client);
    return created;
  });
  sendOtpSms(phone, otp);

  return { userId: user.publicId };
}

export async function resendOtp({ phone, purpose }) {
  const user = await usersRepo.findAuthByPhone(phone);
  if (!user || user.phoneVerifiedAt) {
    return;
  }

  const otp = generateOtp();
  await otpRepo.insert({
    userId: user.id,
    phone,
    otpHash: hashOtp(otp),
    purpose,
    expiresAt: otpExpiresAt(),
  });
  sendOtpSms(phone, otp);
}

// Returns a failure instead of throwing so the attempt counter commits with the transaction.
async function consumeOtp({ phone, otp, purpose }, client) {
  const record = await otpRepo.findLatestActiveForUpdate(phone, purpose, client);
  if (!record) {
    return { failure: new AppError(401, 'OTP_INVALID') };
  }
  if (record.expiresAt.getTime() < Date.now()) {
    return { failure: new AppError(410, 'OTP_EXPIRED') };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    return { failure: new AppError(429, 'RATE_LIMITED') };
  }
  if (hashOtp(otp) !== record.otpHash) {
    await otpRepo.incrementAttempts(record.id, client);
    return { failure: new AppError(401, 'OTP_INVALID') };
  }

  await otpRepo.markVerified(record.id, client);
  return { userId: record.userId };
}

export async function verifyOtp({ phone, otp, purpose }, device) {
  const outcome = await withTransaction(async (client) => {
    const result = await consumeOtp({ phone, otp, purpose }, client);
    if (!result.failure && purpose === 'signup') {
      await usersRepo.markPhoneVerified(result.userId, client);
    }
    return result;
  });

  if (outcome.failure) {
    throw outcome.failure;
  }

  return mintSession(outcome.userId, device);
}

export async function login({ phone, password }, device) {
  const user = await usersRepo.findAuthByPhone(phone);
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'BAD_CREDENTIALS');
  }
  if (user.status === 'suspended' && user.suspendedUntil && user.suspendedUntil <= new Date()) {
    await adminRepo.reinstateExpiredSuspensions(pool, user.id);
    user.status = 'active';
  }
  if (user.status === 'suspended') {
    throw suspendedError(user);
  }
  if (user.status !== 'active') {
    throw new AppError(401, 'BAD_CREDENTIALS');
  }

  // Admins with an authenticator app get a 5-minute challenge instead of a session.
  const twoFactor = await adminRepo.getTwoFactor(user.id);
  if (twoFactor?.enabledAt) {
    return {
      twoFactorRequired: true,
      challengeToken: signScoped(TWO_FACTOR_PURPOSE, { sub: String(user.id) }, '5m'),
    };
  }

  return mintSession(user.id, device);
}

const TWO_FACTOR_PURPOSE = 'admin-2fa-challenge';

export async function completeTwoFactorLogin({ challengeToken, code }, device) {
  const claims = verifyScoped(TWO_FACTOR_PURPOSE, challengeToken);
  if (!claims) throw new AppError(401, 'TOTP_CHALLENGE_EXPIRED');
  const userId = Number(claims.sub);
  const twoFactor = await adminRepo.getTwoFactor(userId);
  if (!twoFactor?.enabledAt || !verifyTotp(twoFactor.secret, code)) throw new AppError(401, 'TOTP_INVALID');
  const user = await usersRepo.findById(userId);
  if (user?.status !== 'active') throw new AppError(401, 'BAD_CREDENTIALS');
  return mintSession(userId, device);
}

export async function refresh(rawRefreshToken) {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const client = await pool.connect();
  let transactionEnded = false;

  try {
    await client.query('BEGIN');
    const record = await sessionsRepo.findByHashForUpdate(tokenHash, client);

    if (!record) {
      transactionEnded = true;
      await client.query('ROLLBACK');
      throw new AppError(401, 'REFRESH_INVALID');
    }

    if (record.revokedAt) {
      await sessionsRepo.revokeActiveForSession(record.sessionId, client);
      await sessionsRepo.endSession(record.sessionId, client);
      transactionEnded = true;
      await client.query('COMMIT');
      throw new AppError(401, 'REFRESH_REUSED');
    }

    if (record.expiresAt.getTime() < Date.now()) {
      transactionEnded = true;
      await client.query('ROLLBACK');
      throw new AppError(401, 'REFRESH_INVALID');
    }

    await sessionsRepo.revoke(record.id, client);
    const newRefreshToken = generateRefreshToken();
    const newTokenId = await sessionsRepo.createRefreshToken(
      {
        userId: record.userId,
        sessionId: record.sessionId,
        tokenHash: hashRefreshToken(newRefreshToken),
        expiresAt: refreshTokenExpiresAt(),
      },
      client,
    );
    await sessionsRepo.setReplacedBy(record.id, newTokenId, client);
    transactionEnded = true;
    await client.query('COMMIT');

    const roles = await rolesRepo.findRoleNamesForUser(record.userId);
    const accessToken = signAccessToken({ userId: record.userId, roles, sessionId: record.sessionId });

    return { accessToken, refreshToken: newRefreshToken };
  } catch (error) {
    if (!transactionEnded) {
      await client.query('ROLLBACK').catch(() => {});
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function logout(sessionId) {
  await sessionsRepo.revokeActiveForSession(sessionId);
  await sessionsRepo.endSession(sessionId);
}

export async function logoutAll(userId) {
  await sessionsRepo.revokeActiveForUser(userId);
  await sessionsRepo.endAllSessionsForUser(userId);
}

export async function requestPasswordReset({ phone }) {
  const user = await usersRepo.findAuthByPhone(phone);
  if (!user || user.status === 'deleted') throw new AppError(404, 'ACCOUNT_NOT_FOUND');

  const otp = generateOtp();
  await otpRepo.insert({ userId: user.id, phone, otpHash: hashOtp(otp), purpose: 'password_reset', expiresAt: otpExpiresAt() });
  sendOtpSms(phone, otp);
}

/** Trades a correct reset code for a short-lived, single-use token that authorizes setting a new password. */
export async function verifyPasswordResetCode({ phone, otp }) {
  const resetToken = generateRefreshToken();
  const outcome = await withTransaction(async (client) => {
    const result = await consumeOtp({ phone, otp, purpose: 'password_reset' }, client);
    if (!result.failure) {
      await passwordResetsRepo.insert({
        userId: result.userId,
        tokenHash: hashRefreshToken(resetToken),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000),
      }, client);
    }
    return result;
  });
  if (outcome.failure) throw outcome.failure;
  return { resetToken };
}

export async function resetPassword({ resetToken, newPassword }) {
  const passwordHash = await hashPassword(newPassword);
  await withTransaction(async (client) => {
    const token = await passwordResetsRepo.findUsableForUpdate(hashRefreshToken(resetToken), client);
    if (!token) throw new AppError(410, 'RESET_TOKEN_INVALID');
    await passwordResetsRepo.markUsed(token.id, client);
    await usersRepo.updatePasswordHash(token.userId, passwordHash, client);
    await sessionsRepo.revokeActiveForUser(token.userId, client);
    await sessionsRepo.endAllSessionsForUser(token.userId, client);
  });
}
