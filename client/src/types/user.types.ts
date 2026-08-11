// doc 05-06-07 §4.1: types/ is "one vocabulary with the backend's DTOs" —
// this mirrors server/src/services/me.service.js's toMeResponse() and
// auth.service.js's toPublicUser() field-for-field.
export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';

// server/src/validators/auth.schema.js's registerSchema.gender
export type Gender = 'female' | 'male' | 'other';

export interface User {
  id: string; // public UUID, not the internal bigint (doc 08-09-10 §11 IDOR defense)
  fullName: string;
  phone: string;
  email: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
  preferredLanguage: 'bn' | 'en';
  phoneVerifiedAt: string | null; // ISO, null = not yet (NULL semantics — doc 04)
  createdAt: string;
  roles: Role[];
  wallet: { balance: string; currency: string }; // money is a STRING (doc 09 §1)
}
