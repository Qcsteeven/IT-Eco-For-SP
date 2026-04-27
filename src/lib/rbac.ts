// ==========================================
// RBAC — Роли и утилиты управления доступом
// ==========================================

export type UserRole = 'guest' | 'user' | 'coach' | 'admin';

export const ROLES: Record<UserRole, UserRole> = {
  guest: 'guest',
  user: 'user',
  coach: 'coach',
  admin: 'admin',
};

// Иерархия ролей (чем выше число, тем больше привилегий)
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  guest: 0,
  user: 1,
  coach: 2,
  admin: 3,
};

// ==========================================
// Разрешения для ролей
// ==========================================

export interface RolePermissions {
  // Просмотр лендинга и маркетинга
  canViewLanding: boolean;
  // Просмотр общего рейтинга
  canViewGlobalRating: boolean;
  // Просмотр грядущих соревнований
  canViewUpcomingContests: boolean;
  // Использование AI-ассистента
  canUseAIAssistant: boolean;
  // Решение задач и участие в контестах
  canParticipateInContests: boolean;
  // Визуализация личного Dashboard
  canViewPersonalDashboard: boolean;
  // Создание и настройка контестов
  canManageContests: boolean;
  // Аналитика по группам пользователей
  canViewAnalytics: boolean;
  // Управление аккаунтами (CRUD)
  canManageUsers: boolean;
  // Ручная корректировка кармы
  canAdjustKarma: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  guest: {
    canViewLanding: true,
    canViewGlobalRating: true,
    canViewUpcomingContests: true,
    canUseAIAssistant: false,
    canParticipateInContests: false,
    canViewPersonalDashboard: false,
    canManageContests: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canAdjustKarma: false,
  },
  user: {
    canViewLanding: true,
    canViewGlobalRating: true,
    canViewUpcomingContests: true,
    canUseAIAssistant: true,
    canParticipateInContests: true,
    canViewPersonalDashboard: true,
    canManageContests: false,
    canViewAnalytics: false,
    canManageUsers: false,
    canAdjustKarma: false,
  },
  coach: {
    canViewLanding: true,
    canViewGlobalRating: true,
    canViewUpcomingContests: true,
    canUseAIAssistant: true,
    canParticipateInContests: true,
    canViewPersonalDashboard: true,
    canManageContests: true,
    canViewAnalytics: true,
    canManageUsers: false,
    canAdjustKarma: false,
  },
  admin: {
    canViewLanding: true,
    canViewGlobalRating: true,
    canViewUpcomingContests: true,
    canUseAIAssistant: true,
    canParticipateInContests: true,
    canViewPersonalDashboard: true,
    canManageContests: true,
    canViewAnalytics: true,
    canManageUsers: true,
    canAdjustKarma: true,
  },
};

// ==========================================
// Утилиты
// ==========================================

/**
 * Проверка, имеет ли роль определённое разрешение
 */
export function hasPermission(
  role: UserRole,
  permission: keyof RolePermissions
): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Проверка, что роль имеет уровень не ниже требуемого
 */
export function hasRoleLevel(
  userRole: UserRole,
  requiredRole: UserRole
): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/**
 * Получить человеко-название роли
 */
export function getRoleDisplayName(role: UserRole): string {
  const names: Record<UserRole, string> = {
    guest: 'Гость',
    user: 'Участник',
    coach: 'Тренер',
    admin: 'Администратор',
  };
  return names[role];
}

/**
 * Валидация значения как UserRole
 */
export function isValidUserRole(value: unknown): value is UserRole {
  return (
    typeof value === 'string' &&
    ['guest', 'user', 'coach', 'admin'].includes(value)
  );
}

/**
 * Получить роль по умолчанию для нового пользователя
 */
export function getDefaultUserRole(): UserRole {
  return 'user';
}

/**
 * Маршруты для редиректа по ролям
 */
export const ROLE_REDIRECT_PATHS: Record<UserRole, string> = {
  guest: '/auth/signin',
  user: '/dashboard',
  coach: '/coach',
  admin: '/admin',
};
