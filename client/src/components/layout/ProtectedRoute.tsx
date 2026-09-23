import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/auth';
import type { Role } from '../../types/user.types';
import { roleHomePath } from '../../utils/roleHomePath';
import { FullScreenSpinner } from './FullScreenSpinner';

export function ProtectedRoute({ roles = [], children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (!user) return <Navigate to="/welcome" replace />;

  const hasRole = roles.length === 0 || roles.some((role) => user.roles.includes(role));
  if (!hasRole) {
    return <Navigate to={roleHomePath(user.roles)} replace />;
  }

  return children;
}
