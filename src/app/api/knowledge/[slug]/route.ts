import { NextResponse } from 'next/server';
import { getKnowledgeMaterial } from '@/lib/knowledge/materials';

type KnowledgeMaterialRouteProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: KnowledgeMaterialRouteProps,
) {
  const { slug } = await params;
  const material = getKnowledgeMaterial(decodeURIComponent(slug));

  if (!material) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Материал не найден',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    ok: true,
    data: material,
  });
}
