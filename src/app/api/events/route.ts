import { NextResponse } from "next/server";
import { getDB } from "@/lib/surreal/surreal";

export async function GET() {
  try {
    const db = await getDB();

    // Получаем все события напрямую
    const events = await db.query("SELECT * FROM event;");

    // Если вдруг SurrealDB вернёт null/undefined, фильтруем
    const allEvents = (events ?? []).filter(Boolean);

    return NextResponse.json({ ok: true, data: allEvents }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
