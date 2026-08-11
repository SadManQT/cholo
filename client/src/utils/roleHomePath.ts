import type { Role } from '../types/user.types';

// doc 12 §3: "after login, users land on their role's home (multi-role
// users get a switcher in Account)." A user with only the DRIVER role has
// no access to "/" (the passenger Book screen) — landing them there on
// purpose, or bouncing them there on a role mismatch, would just replay the
// same redirect forever. This is the one place that decision is made, used
// by both LoginPage (post-login) and ProtectedRoute (role-mismatch escape).
export function roleHomePath(roles: Role[]): string {
  if (roles.includes('PASSENGER')) return '/';
  if (roles.includes('DRIVER')) return '/driver';
  if (roles.includes('ADMIN')) return '/admin';
  return '/welcome'; // every registrant is granted PASSENGER (auth.service.js) — defensive only
}
