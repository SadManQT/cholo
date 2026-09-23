export type Role = 'PASSENGER' | 'DRIVER' | 'ADMIN';

export type Gender = 'female' | 'male' | 'other';

export interface User {
  id: string;
  fullName: string;
  phone: string;
  email: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  photoUrl: string | null;
  preferredLanguage: 'bn' | 'en';
  phoneVerifiedAt: string | null;
  createdAt: string;
  roles: Role[];
  wallet: { balance: string; currency: string };
}
