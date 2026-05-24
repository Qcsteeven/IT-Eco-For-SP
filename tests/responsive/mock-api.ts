import type { Page, Route } from '@playwright/test';
import type { ResponsiveRole } from './routes';

const now = new Date('2026-05-24T09:00:00.000Z').toISOString();
const later = new Date('2026-05-25T12:00:00.000Z').toISOString();

const user = {
  id: 'users:responsive_user',
  full_name: 'Алексей Тестовый',
  email: 'student@example.test',
  role: 'user',
  bscp_rating: 1280,
  codeforces_karma: 42,
  phone: '+7 999 123-45-67',
  cf_username: 'tourist_mock',
  atcoder_username: 'atcoder_mock',
  is_verified: true,
  is_blocked: false,
  registration_date: now,
};

const coach = {
  ...user,
  id: 'users:responsive_coach',
  full_name: 'Мария Тренер',
  email: 'coach@example.test',
  role: 'coach',
};

const admin = {
  ...user,
  id: 'users:responsive_admin',
  full_name: 'Ирина Администратор',
  email: 'admin@example.test',
  role: 'admin',
};

const users = [user, coach, admin];

const groups = [
  {
    id: 'groups:group_alpha',
    name: 'Группа Alpha',
    description: 'Учебная группа для проверки мобильного интерфейса',
    created_at: now,
    updated_at: now,
    members_count: 2,
  },
  {
    id: 'groups:group_beta',
    name: 'Группа Beta с длинным названием',
    description: 'Группа с более длинным описанием для переноса строк',
    created_at: now,
    updated_at: now,
    members_count: 1,
  },
];

const events = [
  {
    id: 'events:responsive_event',
    title: 'Тренировочный контест по динамическому программированию',
    name: 'Тренировочный контест по динамическому программированию',
    description: 'Короткое описание мероприятия',
    platform: 'Codeforces',
    status: 'upcoming',
    start_time_utc: now,
    end_time_utc: later,
    registration_link: 'https://codeforces.com/contest/1',
    external_link: 'https://codeforces.com/contest/1',
    visibility_type: 'public',
    participant_list: [],
    target_groups: ['groups:group_alpha'],
    source: 'contests',
  },
];

const chatSessions = [
  {
    id: 'chat_sessions:responsive_chat',
    title: 'Как начать тренироваться',
    preview: 'Подбери короткий план на неделю',
    created_at: now,
    updated_at: now,
    messages: [
      {
        id: 'message_1',
        role: 'user',
        text: 'Как начать тренироваться?',
        created_at: now,
      },
      {
        id: 'message_2',
        role: 'assistant',
        text: 'Начните с простых задач и коротких разборов после каждой попытки.',
        created_at: now,
      },
    ],
  },
];

const karmaLogs = [
  {
    id: 'karma_adjustments:responsive_log',
    user: 'users:responsive_user',
    user_name: user.full_name,
    user_email: user.email,
    admin: 'users:responsive_admin',
    admin_name: admin.full_name,
    amount: 5,
    reason: 'Активная работа на тренировке',
    created_at: now,
  },
];

function currentUserForRole(role: ResponsiveRole) {
  if (role === 'admin') return admin;
  if (role === 'coach') return coach;
  if (role === 'user') return user;
  return null;
}

function json(body: unknown, status = 200) {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  };
}

function authSession(role: ResponsiveRole) {
  const sessionUser = currentUserForRole(role);
  if (!sessionUser) return {};

  return {
    user: {
      id: sessionUser.id,
      name: sessionUser.full_name,
      email: sessionUser.email,
      role: sessionUser.role,
    },
    expires: '2099-01-01T00:00:00.000Z',
  };
}

function apiResponse(url: URL, method: string, role: ResponsiveRole) {
  const pathname = url.pathname;
  const sessionUser = currentUserForRole(role) ?? user;

  if (pathname === '/api/auth/session') return json(authSession(role));
  if (pathname.startsWith('/api/auth/')) return json({});

  if (pathname === '/api/profile') {
    return json({
      ok: true,
      data: {
        user: sessionUser,
        history: [
          {
            date_recorded: now,
            placement: '12',
            mmr_change: 18,
            is_manual: false,
            source_rating_change: 'Codeforces',
            contest: {
              id: 'contests:responsive_contest',
              title: 'Codeforces Round mock',
              platform: 'Codeforces',
            },
          },
        ],
      },
    });
  }

  if (pathname === '/api/profile/codeforces') {
    return json({
      ok: true,
      data: {
        connected: true,
        cf_username: sessionUser.cf_username,
        user_info: {
          rating: 1320,
          max_rating: 1400,
          rank: 'pupil',
          attended_contests_count: 12,
        },
        submissions: [],
      },
    });
  }

  if (pathname === '/api/profile/atcoder') {
    return json({
      ok: true,
      data: {
        connected: true,
        atcoder_username: sessionUser.atcoder_username,
        user_info: {
          rating: 840,
          rank: 'green',
          attended_contests_count: 6,
          rated_point_sum: 120,
        },
        submissions: [],
      },
    });
  }

  if (pathname === '/api/codeforces/karma') {
    return json({
      ok: true,
      data: {
        karma: 42,
        karmaLevel: 'Стабильный прогресс',
        karmaColor: '#23bcba',
        breakdown: {
          easyKarma: 10,
          mediumKarma: 20,
          hardKarma: 5,
          tagBonusKarma: 4,
          diversityBonus: 3,
        },
        details: {
          totalSolved: 18,
          easyCount: 8,
          mediumCount: 7,
          hardCount: 3,
          averageRating: 1100,
          uniqueTags: 9,
        },
        difficultyDistribution: { easy: 8, medium: 7, hard: 3 },
        tagStats: [],
        problems: [],
      },
    });
  }

  if (pathname === '/api/atcoder/problems') return json({ ok: true, data: [] });
  if (pathname.startsWith('/api/atcoder/')) return json({ ok: true, data: [] });

  if (pathname === '/api/events') return json({ ok: true, data: events });
  if (pathname === '/api/contests/all') return json(events);
  if (pathname === '/api/users') return json({ ok: true, data: users });
  if (pathname === '/api/admin/users') return json({ ok: true, data: users });
  if (pathname.startsWith('/api/admin/users/')) {
    return json({ ok: true, data: user });
  }
  if (pathname === '/api/admin/karma') {
    if (method === 'POST') return json({ ok: true, data: karmaLogs[0] });
    return json({ ok: true, data: karmaLogs });
  }

  if (pathname === '/api/groups') return json({ ok: true, data: groups });
  if (pathname === '/api/groups/group_alpha') {
    return json({ ok: true, data: groups[0] });
  }
  if (pathname === '/api/groups/group_alpha/members') {
    return json({ ok: true, data: users.slice(0, 2) });
  }
  if (pathname === '/api/coach/groups/group_alpha/analytics') {
    return json({
      ok: true,
      data: {
        group: groups[0],
        totals: {
          members: 2,
          average_rating: 1260,
          solved_tasks: 34,
          active_members: 2,
        },
        members: users.slice(0, 2),
        timeline: [],
        platforms: [
          { platform: 'Codeforces', count: 18 },
          { platform: 'AtCoder', count: 8 },
        ],
      },
    });
  }

  if (pathname === '/api/chat/sessions') {
    if (method === 'POST') return json({ ok: true, data: chatSessions[0] });
    return json({ ok: true, data: chatSessions });
  }
  if (pathname.startsWith('/api/chat/sessions/')) {
    if (method === 'DELETE') return json({ ok: true, data: null });
    return json({ ok: true, data: chatSessions[0] });
  }
  if (pathname === '/api/chat') {
    return {
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: {"choices":[{"delta":{"content":"Ответ готов."}}]}\n\ndata: [DONE]\n\n',
    };
  }

  return json({ ok: true, data: [] });
}

export async function installMockApi(page: Page, role: ResponsiveRole) {
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    await route.fulfill(apiResponse(url, request.method(), role));
  });
}
