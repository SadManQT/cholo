import type { Role } from '../types/user.types';

// Most specific role wins: every driver who signs up in the app is also a passenger, so checking PASSENGER
// first would never land a driver on Driver Home. The Account page offers a switch back to riding.
export function roleHomePath(roles: Role[]): string {
  if (roles.includes('ADMIN')) return '/admin';
  if (roles.includes('DRIVER')) return '/driver';
  if (roles.includes('PASSENGER')) return '/';
  return '/welcome';
}
