/**
 * usePermission — Hook for permission-based feature flags
 *
 * Reads the resolved permission list from Redux auth state and blends
 * it with project-scoped roles dynamically based on filters.projectId.
 *
 * Support for multi-roles: splits comma-separated role strings.
 */
import { useSelector } from 'react-redux';
import { RootState } from '../store';

export const PERMISSIONS = {
  CREATE: 'create',
  READ: 'read',
  UPDATE: 'update',
  DELETE: 'delete',
  APPROVE: 'approve',
  EXPORT: 'export',
  MANAGE_USERS: 'manage_users',
  MANAGE_PROJECTS: 'manage_projects',
} as const;

export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  'Super Admin': ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage_users', 'manage_projects'],
  'Group Admin': ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage_users', 'manage_projects'],
  'Company Admin': ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage_users', 'manage_projects'],
  'Project Manager': ['create', 'read', 'update', 'delete', 'approve', 'export', 'manage_projects'],
  'QA Lead': ['create', 'read', 'update', 'delete', 'approve', 'export'],
  'QA Engineer': ['create', 'read', 'update', 'export'],
  'Developer': ['create', 'read', 'update'],
  'Client': ['read', 'export'],
  'Viewer': ['read'],
};

/**
 * Helper to resolve permissions by blending global roles and project-scoped roles
 */
export function resolveUserPermissions(user: any, projectId: number | null, globalPermissions: string[]): string[] {
  if (!user) return [];
  const userRoles = (user.role || '').split(',').map((r: string) => r.trim());
  if (userRoles.includes('Super Admin')) {
    return ROLE_PERMISSION_MATRIX['Super Admin'];
  }

  const resolved = new Set<string>(globalPermissions);
  
  // Blend project-scoped permissions if a project is selected
  if (projectId && user.project_roles && user.project_roles[projectId]) {
    const projRoles = (user.project_roles[projectId] || '').split(',').map((r: string) => r.trim());
    if (projRoles.includes('Super Admin')) {
      return ROLE_PERMISSION_MATRIX['Super Admin'];
    }
    projRoles.forEach((role: string) => {
      const perms = ROLE_PERMISSION_MATRIX[role] || [];
      perms.forEach(p => resolved.add(p));
    });
  }
  
  return Array.from(resolved);
}

/**
 * Check if the current user has a specific permission.
 */
export function usePermission(permission: PermissionKey | string): boolean {
  const { user, permissions } = useSelector((state: RootState) => state.auth);
  const projectId = useSelector((state: RootState) => state.filters.projectId);

  if (!user) return false;
  const userRoles = (user.role || '').split(',').map((r: string) => r.trim());
  if (userRoles.includes('Super Admin')) return true;

  const resolvedPerms = resolveUserPermissions(user, projectId, permissions);
  return resolvedPerms.includes(permission);
}

/**
 * Check if the current user has ALL of the listed permissions.
 */
export function usePermissions(requiredPermissions: (PermissionKey | string)[]): boolean {
  const { user, permissions } = useSelector((state: RootState) => state.auth);
  const projectId = useSelector((state: RootState) => state.filters.projectId);

  if (!user) return false;
  const userRoles = (user.role || '').split(',').map((r: string) => r.trim());
  if (userRoles.includes('Super Admin')) return true;

  const resolvedPerms = resolveUserPermissions(user, projectId, permissions);
  return requiredPermissions.every(p => resolvedPerms.includes(p));
}

/**
 * Check if the current user has ANY of the listed permissions.
 */
export function useAnyPermission(anyOfPermissions: (PermissionKey | string)[]): boolean {
  const { user, permissions } = useSelector((state: RootState) => state.auth);
  const projectId = useSelector((state: RootState) => state.filters.projectId);

  if (!user) return false;
  const userRoles = (user.role || '').split(',').map((r: string) => r.trim());
  if (userRoles.includes('Super Admin')) return true;

  const resolvedPerms = resolveUserPermissions(user, projectId, permissions);
  return anyOfPermissions.some(p => resolvedPerms.includes(p));
}

/**
 * Returns the full list of current user's permissions.
 */
export function useMyPermissions(): string[] {
  const { user, permissions } = useSelector((state: RootState) => state.auth);
  const projectId = useSelector((state: RootState) => state.filters.projectId);

  return resolveUserPermissions(user, projectId, permissions);
}

export default usePermission;
