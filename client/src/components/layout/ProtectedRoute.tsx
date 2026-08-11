import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import type { Role } from '../../types/user.types';
import { roleHomePath } from '../../utils/roleHomePath';
import { FullScreenSpinner } from './FullScreenSpinner';

// doc 11 §8: "UX, not security — the API is the security (doc 06 §2)."
// Every check here is also enforced server-side (auth middleware,
// requireRole, ownership checks in services); this only decides what the
// SPA renders, never what the backend allows.
//
// `roles` omitted/empty means "any authenticated user" — e.g. doc 08-09-10
// §6's POST /driver/apply is `auth`-only server-side (a PASSENGER applying
// to become a driver doesn't have the DRIVER role YET), so its route can't
// be gated the same way the rest of /driver/* is.
export function ProtectedRoute({ roles = [], children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/login" replace />;

  const hasRole = roles.length === 0 || roles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    // Not hardcoded "/" (doc 11 §8's own snippet does this, but "/" is the
    // PASSENGER home — a driver-only user bounced there would just fail
    // the check again and loop). Send them to a role they actually have.
    return <Navigate to={roleHomePath(user.roles)} replace />;
  }

  return children;
}
