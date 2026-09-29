import type { Role } from '../types/user.types';

export function roleHomePath(roles: Role[]): string {
  if (roles.includes('ADMIN')) return '/admin';
  if (roles.includes('DRIVER')) return '/driver';
  if (roles.includes('PASSENGER')) return '/';
  return '/welcome';
}
