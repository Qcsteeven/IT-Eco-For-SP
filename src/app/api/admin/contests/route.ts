// GET /api/admin/contests — получение списка контестов (coach/admin)
// POST /api/admin/contests — создание контеста (coach/admin)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';

// ==========================================
// GET — получение списка контестов
// ==========================================

const getHandler = withRoleGuard(
  async (_req: NextRequest, _session) => {
    try {
      void _req;
      void _session;
      const db = await getDB();

      const result = await db.query(
        'SELECT * FROM contests ORDER BY date DESC'
      );

      const contests = (result as unknown as Record<string, { result?: unknown[] }>)['0']?.result || [];

      return NextResponse.json({
        ok: true,
        data: contests,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Contests] Ошибка получения контестов:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось получить список контестов' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'coach' }
);

export { getHandler as GET };

// ==========================================
// POST — создание контеста
// ==========================================

const postHandler = withRoleGuard(
  async (req: NextRequest, session) => {
    try {
      const body = await req.json() as Record<string, unknown>;
      const {
        name,
        description,
        date,
        duration,
        platform,
        isPublic,
      } = body;

      if (!name || !date) {
        return NextResponse.json(
          { ok: false, error: 'Необходимы name и date' },
          { status: 400 }
        );
      }

      const db = await getDB();

      const contestData = {
        name,
        description: description || '',
        date: new Date(date as string),
        duration: duration || 0,
        platform: platform || 'custom',
        is_public: isPublic !== undefined ? isPublic : true,
        created_by: session.user.id,
        created_at: new Date(),
      };

      const result = await db.query(
        'CREATE contests SET name = $name, description = $description, date = $date, duration = $duration, platform = $platform, is_public = $is_public, created_by = $createdBy, created_at = $createdAt',
        {
          name: contestData.name,
          description: contestData.description,
          date: contestData.date,
          duration: contestData.duration,
          platform: contestData.platform,
          is_public: contestData.is_public,
          createdBy: contestData.created_by,
          createdAt: contestData.created_at,
        }
      );

      const createdContest = (result as unknown as Record<string, { result?: unknown[] }>)['0']?.result?.[0];

      return NextResponse.json({
        ok: true,
        data: createdContest,
        message: 'Контест создан',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Contests] Ошибка создания контеста:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось создать контест' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'coach' }
);

export { postHandler as POST };
