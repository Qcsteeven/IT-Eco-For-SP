import { NextResponse } from 'next/server';
import { knowledgeGroups } from '@/lib/knowledge/materials';

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: knowledgeGroups,
  });
}
