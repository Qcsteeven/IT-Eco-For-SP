import { NextResponse } from "next/server";
import { getDB } from "@/lib/surreal/surreal";

type QueryResult<T = unknown> = {
  result: T;
};

export async function GET() {
  try {
    const db = await getDB();

    const info = (await db.query("SELECT * FROM info;")) as QueryResult[];

    return NextResponse.json(
      { ok: true, data: info[0]?.result ?? [] },
      { status: 200 }
    );
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
