// ==========================================
// RBAC Permission Utilities
// Примеры использования granular permission checks
// ==========================================

import { UserRole, hasPermission, ROLE_PERMISSIONS, RolePermissions } from '@/lib/rbac';

/**
 * Получает список разрешений для роли
 */
export function getPermissionsForRole(role: UserRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

/**
 * Проверяет несколько разрешений одновременно
 * Возвращает true, если ВСЕ разрешения есть у роли
 */
export function hasAllPermissions(
  role: UserRole,
  permissions: (keyof RolePermissions)[]
): boolean {
  return permissions.every((perm) => hasPermission(role, perm));
}

/**
 * Проверяет, есть ли ХОТЯ БЫ ОДНО из перечисленных разрешений
 */
export function hasAnyPermission(
  role: UserRole,
  permissions: (keyof RolePermissions)[]
): boolean {
  return permissions.some((perm) => hasPermission(role, perm));
}

/**
 * Middleware-подобная функция для проверки разрешений в API роутах
 * Используется вместо hasRoleLevel для более гранулярного контроля
 */
export function checkPermission(
  userRole: UserRole,
  requiredPermission: keyof RolePermissions
): { authorized: boolean; message: string } {
  if (hasPermission(userRole, requiredPermission)) {
    return {
      authorized: true,
      message: 'Доступ разрешён',
    };
  }

  return {
    authorized: false,
    message: `Доступ запрещён: требуется разрешение ${requiredPermission}`,
  };
}

/**
 * Пример использования в клиентских компонентах
 * Возвращает объект с флагами для условного рендеринга
 */
export function usePermissions(role: UserRole) {
  return {
    canViewLanding: hasPermission(role, 'canViewLanding'),
    canViewGlobalRating: hasPermission(role, 'canViewGlobalRating'),
    canViewUpcomingContests: hasPermission(role, 'canViewUpcomingContests'),
    canUseAIAssistant: hasPermission(role, 'canUseAIAssistant'),
    canParticipateInContests: hasPermission(role, 'canParticipateInContests'),
    canViewPersonalDashboard: hasPermission(role, 'canViewPersonalDashboard'),
    canManageContests: hasPermission(role, 'canManageContests'),
    canViewAnalytics: hasPermission(role, 'canViewAnalytics'),
    canManageUsers: hasPermission(role, 'canManageUsers'),
    canAdjustKarma: hasPermission(role, 'canAdjustKarma'),
  };
}

/**
 * Пример использования в серверных компонентах
 * Генерирует список доступных функций для роли
 */
export function getAvailableFeatures(role: UserRole): string[] {
  const permissions = ROLE_PERMISSIONS[role];
  return Object.entries(permissions)
    .filter(([, value]) => value)
    .map(([key]) => key);
}

/**
 * Проверка доступа к конкретному ресурсу
 * Более читаемая обёртка для hasPermission
 */
export function can(role: UserRole, action: keyof RolePermissions): boolean {
  return hasPermission(role, action);
}

/**
 * Группировка разрешений по категориям
 */
export const PERMISSION_CATEGORIES = {
  viewing: ['canViewLanding', 'canViewGlobalRating', 'canViewUpcomingContests', 'canViewPersonalDashboard'] as const,
  participation: ['canParticipateInContests', 'canUseAIAssistant'] as const,
  management: ['canManageContests', 'canViewAnalytics', 'canManageUsers', 'canAdjustKarma'] as const,
} as const;

/**
 * Проверяет, есть ли у роли доступа к целой категории разрешений
 */
export function hasPermissionCategory(
  role: UserRole,
  category: keyof typeof PERMISSION_CATEGORIES
): boolean {
  const permissions = PERMISSION_CATEGORIES[category];
  return hasAllPermissions(role, permissions as unknown as (keyof RolePermissions)[]);
}
