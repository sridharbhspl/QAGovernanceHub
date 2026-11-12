/**
 * PermissionGate — Conditionally render children based on user permissions.
 *
 * Usage:
 *   <PermissionGate permission="create">
 *     <Button>Create Defect</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate permission="approve" fallback={<Chip label="View Only" />}>
 *     <Button>Approve</Button>
 *   </PermissionGate>
 *
 *   <PermissionGate anyOf={['create', 'update']} roles={['QA Lead', 'QA Engineer']}>
 *     <EditPanel />
 *   </PermissionGate>
 */
import React from 'react';
import { useSelector } from 'react-redux';
import { usePermission, useAnyPermission, usePermissions } from '../hooks/usePermission';
import { RootState } from '../store';

interface PermissionGateProps {
  /** Require this single permission */
  permission?: string;
  /** Require ALL of these permissions */
  allOf?: string[];
  /** Require ANY of these permissions */
  anyOf?: string[];
  /** Restrict to specific roles (in addition to permission check) */
  roles?: string[];
  /** What to render if the user doesn't have permission. Defaults to null (nothing). */
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

const PermissionGate: React.FC<PermissionGateProps> = ({
  permission,
  allOf,
  anyOf,
  roles,
  fallback = null,
  children,
}) => {
  const { user } = useSelector((state: RootState) => state.auth);

  // Super Admin bypasses all gates
  if (user?.role === 'Super Admin') return <>{children}</>;

  // Role-based check (optional additional restriction)
  if (roles && roles.length > 0) {
    if (!user || !roles.includes(user.role)) return <>{fallback}</>;
  }

  // Permission checks
  let hasAccess = true;

  if (permission) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hasAccess = usePermission(permission);
  } else if (allOf && allOf.length > 0) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hasAccess = usePermissions(allOf);
  } else if (anyOf && anyOf.length > 0) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hasAccess = useAnyPermission(anyOf);
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default PermissionGate;
