import { NextResponse } from "next/server";
import { getDB } from "@/lib/surreal";

type QueryResult<T = any> = {
  result: T;
};

export async function GET() {
  try {
    const db = await getDB();

    // Явно типизируем результат
    const info = (await db.query("SELECT * FROM info;")) as QueryResult[];

    return NextResponse.json(
      { ok: true, data: info[0]?.result ?? [] },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || String(err) },
      { status: 500 }
    );
  }
}
