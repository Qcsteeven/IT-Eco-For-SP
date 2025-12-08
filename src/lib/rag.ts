// src/lib/rag.ts
export async function getRagContext(query: string | undefined): Promise<string> {
  // Защита от undefined или null
  const safeQuery = (query ?? '').trim();

  if (safeQuery.toLowerCase().includes('дедлайн')) {
    return 'Дедлайн по задаче "AI-агент" — 14 декабря 2025.';
  }
  if (safeQuery.toLowerCase().includes('rag')) {
    return 'RAG (Retrieval-Augmented Generation) — метод, при котором к запросу добавляется релевантный контекст из базы знаний.';
  }
  return '';
}