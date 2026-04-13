// ==========================================
// RBAC Index — экспортирует все утилиты
// ==========================================

export type {
  UserRole,
  RolePermissions,
} from '../rbac';

export {
  ROLES,
  ROLE_HIERARCHY,
  ROLE_PERMISSIONS,
  ROLE_REDIRECT_PATHS,
} from '../rbac';

export {
  hasPermission,
  hasRoleLevel,
  getRoleDisplayName,
  isValidUserRole,
  getDefaultUserRole,
} from '../rbac';

// Клиентские хуки
export { useRoleGuard, useRoleRedirect } from './client';

// Серверные garde
export { withRoleGuard, getSessionWithRole } from './guard';
export type { RoleGuardOptions } from './guard';

// Утилиты для granular permissions
export {
  getPermissionsForRole,
  hasAllPermissions,
  hasAnyPermission,
  checkPermission,
  usePermissions,
  getAvailableFeatures,
  can,
  PERMISSION_CATEGORIES,
  hasPermissionCategory,
} from './permissions';
