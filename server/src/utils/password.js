import bcrypt from 'bcrypt';

const BCRYPT_COST = 12;

// A real hash of a random password — bcrypt.compare against this when a
// user doesn't exist, so login takes the same ~250ms either way and phone
// enumeration can't be timed (doc 10 §6).
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO7GH2Q7Vp2K.9qOL3Y1U0kA9xJmXNhVi';

export function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash ?? DUMMY_HASH);
}
