// PATCH /api/admin/contests/[id] — обновление контеста (coach/admin)
// DELETE /api/admin/contests/[id] — удаление контеста (coach/admin)

import { NextResponse, NextRequest } from 'next/server';
import { getDB } from '@/lib/surreal/surreal';
import { withRoleGuard } from '@/lib/rbac/guard';

// ==========================================
// PATCH — обновление контеста
// ==========================================

const patchHandler = withRoleGuard(
  async (req: NextRequest, _session) => {
    try {
      void _session;
      const urlPath = req.url.split('/api/admin/contests/')[1];
      const contestId = urlPath;

      if (!contestId) {
        return NextResponse.json(
          { ok: false, error: 'ID контеста не указан' },
          { status: 400 }
        );
      }

      const body = await req.json() as Record<string, unknown>;

      const db = await getDB();

      // Формируем динамический UPDATE
      const updateFields: string[] = [];
      const variables: Record<string, unknown> = { id: contestId };

      if (body.name !== undefined) {
        updateFields.push('name = $name');
        variables.name = body.name;
      }
      if (body.description !== undefined) {
        updateFields.push('description = $description');
        variables.description = body.description;
      }
      if (body.date !== undefined) {
        updateFields.push('date = $date');
        variables.date = new Date(body.date as string);
      }
      if (body.duration !== undefined) {
        updateFields.push('duration = $duration');
        variables.duration = body.duration;
      }
      if (body.platform !== undefined) {
        updateFields.push('platform = $platform');
        variables.platform = body.platform;
      }
      if (body.isPublic !== undefined) {
        updateFields.push('is_public = $is_public');
        variables.is_public = body.isPublic;
      }

      if (updateFields.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Нет полей для обновления' },
          { status: 400 }
        );
      }

      const query = `UPDATE type::thing("contests", $id) SET ${updateFields.join(', ')}`;
      const result = await db.query(query, variables);

      const updatedContest = (result as unknown as Record<string, { result?: unknown[] }>)['0']?.result?.[0];

      if (!updatedContest) {
        return NextResponse.json(
          { ok: false, error: 'Контест не найден' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        ok: true,
        data: updatedContest,
        message: 'Контест обновлён',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Contests] Ошибка обновления контеста:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось обновить контест' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'admin' }
);

export { patchHandler as PATCH };

// ==========================================
// DELETE — удаление контеста
// ==========================================

const deleteHandler = withRoleGuard(
  async (req: NextRequest, _session) => {
    try {
      void _session;
      const urlPath = req.url.split('/api/admin/contests/')[1];
      const contestId = urlPath;

      if (!contestId) {
        return NextResponse.json(
          { ok: false, error: 'ID контеста не указан' },
          { status: 400 }
        );
      }

      const db = await getDB();

      await db.query('DELETE type::thing("contests", $id)', { id: contestId });

      return NextResponse.json({
        ok: true,
        message: 'Контест удалён',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[Admin/Contests] Ошибка удаления контеста:', errorMessage);
      return NextResponse.json(
        { ok: false, error: 'Не удалось удалить контест' },
        { status: 500 }
      );
    }
  },
  { requiredRole: 'admin' }
);

export { deleteHandler as DELETE };
