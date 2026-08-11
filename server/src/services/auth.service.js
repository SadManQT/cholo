import { pool } from '../config/db.js';
import * as otpRepo from '../repositories/otp.repository.js';
import * as passengersRepo from '../repositories/passengers.repository.js';
import * as rolesRepo from '../repositories/roles.repository.js';
import * as sessionsRepo from '../repositories/sessions.repository.js';
import * as usersRepo from '../repositories/users.repository.js';
import { AppError } from '../utils/AppError.js';
import { OTP_MAX_ATTEMPTS, generateOtp, hashOtp, otpExpiresAt } from '../utils/otp.js';
import { hashPassword, verifyPassword } from '../utils/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiresAt,
  signAccessToken,
} from '../utils/tokens.js';
import { sendOtpSms } from './sms.service.js';

function toPublicUser(user, roles) {
  return {
    id: user.publicId,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email ?? null,
    roles,
  };
}

// Shared by verifyOtp (signup) and login — both end the same way: doc 10 §5
// step "mint session + tokens (same as login §6 steps 4-6)".
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

export async function register({ fullName, phone, password, gender }) {
  const passwordHash = await hashPassword(password);
  // Unique violation on phone becomes 409 DUPLICATE via the central
  // errorHandler (doc 08 §9) — no separate pre-check, which would just
  // race the same constraint.
  const user = await usersRepo.insert({ fullName, phone, passwordHash, gender });

  const passengerRoleId = await rolesRepo.findIdByName('PASSENGER');
  if (!passengerRoleId) {
    throw new Error('PASSENGER role is not seeded — run database/seeds/seed.reference.sql');
  }
  await rolesRepo.assignRole(user.id, passengerRoleId);
  // Every registrant is granted PASSENGER above, so every registrant needs
  // the matching profile row — ride_requests.passenger_id (and trips,
  // favorite_drivers) FK to passenger_profiles(user_id), not users(id).
  await passengersRepo.insertProfile(user.id);

  const otp = generateOtp();
  await otpRepo.insert({
    userId: user.id,
    phone,
    otpHash: hashOtp(otp),
    purpose: 'signup',
    expiresAt: otpExpiresAt(),
  });
  sendOtpSms(phone, otp);

  return { userId: user.publicId };
}

// doc 08-09-10 §4's route table: "POST /auth/resend-otp | public | New OTP
// · phone, purpose | 204 | 429 RATE_LIMITED (SMS costs money)." Always 204,
// even for a phone with no pending signup — same no-enumeration shape as
// /auth/forgot-password (doc 08 §8): the response can't be used to probe
// which phone numbers exist or are already verified.
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

export async function verifyOtp({ phone, otp, purpose }, device) {
  const record = await otpRepo.findLatestActive(phone, purpose);
  if (!record) {
    throw new AppError(401, 'OTP_INVALID');
  }
  if (record.expiresAt.getTime() < Date.now()) {
    throw new AppError(410, 'OTP_EXPIRED');
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    throw new AppError(429, 'RATE_LIMITED');
  }
  if (hashOtp(otp) !== record.otpHash) {
    await otpRepo.incrementAttempts(record.id);
    throw new AppError(401, 'OTP_INVALID');
  }

  await otpRepo.markVerified(record.id);

  if (purpose === 'signup') {
    await usersRepo.markPhoneVerified(record.userId);
  }

  return mintSession(record.userId, device);
}

export async function login({ phone, password }, device) {
  const user = await usersRepo.findAuthByPhone(phone);
  // Always compare, even when no user was found (against a dummy hash) —
  // timing must not reveal whether the phone exists (doc 10 §6).
  const passwordMatches = await verifyPassword(password, user?.passwordHash);

  if (!user || !passwordMatches) {
    throw new AppError(401, 'BAD_CREDENTIALS');
  }
  if (user.status === 'suspended') {
    throw new AppError(403, 'ACCOUNT_SUSPENDED');
  }
  if (user.status !== 'active') {
    // e.g. soft-deleted: don't distinguish this from bad credentials either.
    throw new AppError(401, 'BAD_CREDENTIALS');
  }

  return mintSession(user.id, device);
}

// Rotation + reuse detection (doc 10 §7). One connection, one transaction:
// the SELECT ... FOR UPDATE holds the row lock for the whole rotate step so
// two refreshes racing on the same token can't both succeed.
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
      // This exact token was already rotated away once — someone is
      // replaying a dead token. Could be the real user's stale copy or a
      // thief's stolen copy; there's no way to tell which, so treat it as
      // a compromise and kill the whole session rather than just this token.
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

    // Revoke the old token BEFORE inserting the new one: both rows would
    // otherwise be simultaneously unrevoked for this session, violating
    // ux_refresh_active_per_session (at most one active token per session).
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
