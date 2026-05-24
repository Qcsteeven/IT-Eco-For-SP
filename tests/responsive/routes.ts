export type ResponsiveRole = 'guest' | 'user' | 'coach' | 'admin';

export type ResponsiveRoute = {
  name: string;
  path: string;
  role: ResponsiveRole;
  keyText: string;
};

export const responsiveRoutes: ResponsiveRoute[] = [
  { name: 'home', path: '/home', role: 'guest', keyText: 'Что такое' },
  {
    name: 'knowledge',
    path: '/base',
    role: 'guest',
    keyText: 'Учебные материалы',
  },
  {
    name: 'knowledge-guide',
    path: '/base/competitive-programming-intro',
    role: 'guest',
    keyText: 'Практика',
  },
  { name: 'calendar', path: '/calendar', role: 'guest', keyText: 'Календарь' },
  { name: 'signin', path: '/auth/signin', role: 'guest', keyText: 'Вход' },
  {
    name: 'signup',
    path: '/auth/signup',
    role: 'guest',
    keyText: 'Регистрация',
  },
  {
    name: 'verify-email',
    path: '/auth/verify-email',
    role: 'guest',
    keyText: 'подтверждение',
  },
  {
    name: 'forgot-password',
    path: '/auth/forgot-password',
    role: 'guest',
    keyText: 'пароль',
  },
  {
    name: 'reset-password',
    path: '/auth/reset-password',
    role: 'guest',
    keyText: 'пароль',
  },
  { name: 'dashboard', path: '/dashboard', role: 'user', keyText: 'Панель' },
  { name: 'profile', path: '/profile', role: 'user', keyText: 'Профиль' },
  { name: 'chat', path: '/chat', role: 'user', keyText: 'Эко' },
  { name: 'coach', path: '/coach', role: 'coach', keyText: 'Тренерская' },
  {
    name: 'coach-contests',
    path: '/coach/contests',
    role: 'coach',
    keyText: 'Контесты',
  },
  {
    name: 'coach-events',
    path: '/coach/events',
    role: 'coach',
    keyText: 'Мероприятия',
  },
  {
    name: 'coach-groups',
    path: '/coach/groups',
    role: 'coach',
    keyText: 'Группы',
  },
  {
    name: 'coach-group-edit',
    path: '/coach/groups/group_alpha',
    role: 'coach',
    keyText: 'Редактирование',
  },
  {
    name: 'coach-group-analytics',
    path: '/coach/groups/group_alpha/analytics',
    role: 'coach',
    keyText: 'Аналитика',
  },
  {
    name: 'admin',
    path: '/admin',
    role: 'admin',
    keyText: 'Администрирование',
  },
  {
    name: 'admin-users',
    path: '/admin/users',
    role: 'admin',
    keyText: 'Пользователи',
  },
  {
    name: 'admin-karma',
    path: '/admin/karma',
    role: 'admin',
    keyText: 'карма',
  },
];

export const responsiveViewports = [
  { name: 'mobile-360', width: 360, height: 740 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'mobile-430', width: 430, height: 932 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1366', width: 1366, height: 768 },
] as const;
