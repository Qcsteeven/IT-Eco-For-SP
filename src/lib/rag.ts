import { getDB } from "@/lib/surreal/surreal";
import { getEmbedding } from "@/lib/embedding"; // ваша функция Fireworks

interface NewsItem {
  id: any;
  title: string;
  content: string;
  publish_date: string;
  registration_link?: string;
}

interface Contest {
  id: any;
  title: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;
  similarity?: number; // добавим для удобства
}

export async function getRagContext(query: string | undefined): Promise<string> {
  const safeQuery = (query ?? '').trim();
  if (!safeQuery) return '';

  const lowerQuery = safeQuery.toLowerCase();

  // Базовые ответы
  if (lowerQuery.includes('дедлайн')) {
    return 'Дедлайн по задаче "AI-агент" — 14 декабря 2025.';
  }
  if (lowerQuery.includes('rag')) {
    return 'RAG (Retrieval-Augmented Generation) — метод, при котором к запросу добавляется релевантный контекст из базы знаний.';
  }

  try {
    const db = await getDB();
    let context = '';

    if (lowerQuery.includes('новости') || lowerQuery.includes('новость')) {
      const newsResult = await db.query(
        `SELECT * FROM news ORDER BY publish_date DESC LIMIT 5`
      );
      const newsItems: NewsItem[] = Array.isArray(newsResult) && newsResult.length > 0 
        ? (newsResult[0] as NewsItem[]) 
        : [];

      if (newsItems.length > 0) {
        context += '📰 Последние новости:\n';
        newsItems.forEach((item) => {
          const date = item.publish_date
            ? new Date(item.publish_date).toLocaleDateString('ru-RU')
            : 'Без даты';
          const contentPreview = item.content?.length > 100 
            ? `${item.content.substring(0, 100)}...` 
            : item.content || 'Без содержания';
          context += `- ${item.title || 'Без заголовка'} (${date})\n`;
          context += `  ${contentPreview}\n`;
          context += `  Источник: ${item.registration_link?.trim() || 'внутренняя рассылка'}\n\n`;
        });
      }
    }


    if (lowerQuery.includes('контест') || lowerQuery.includes('соревновани')) {
      try {
        const queryEmbedding = await getEmbedding(safeQuery); // исходный query, не lowercase

        const contestResult = await db.query(
          `
          SELECT 
            *,
            vector::similarity::cosine(embedding, $query_vector) AS similarity
          FROM contests
          WHERE embedding <|20|> $query_vector
          ORDER BY similarity DESC
          LIMIT 5;
          `,
          { query_vector: queryEmbedding }
        );

        const contests: Contest[] = Array.isArray(contestResult) && contestResult.length > 0 
          ? (contestResult[0] as Contest[]) 
          : [];

        if (contests.length > 0) {
          context += '🎯 Релевантные контесты (по смыслу):\n';
          contests.forEach((contest) => {
            const start = contest.start_time_utc
              ? new Date(contest.start_time_utc).toLocaleString('ru-RU')
              : 'Неизвестно';
            const end = contest.end_time_utc
              ? new Date(contest.end_time_utc).toLocaleString('ru-RU')
              : 'Неизвестно';

            context += `- ${contest.title || 'Без названия'} (${contest.platform || 'Codeforces'})\n`;
            context += `  Время: ${start} – ${end}\n`;
            context += `  Регистрация: ${contest.registration_link?.trim() || '—'}\n`;
            if (contest.similarity !== undefined) {
              context += `  Схожесть: ${(contest.similarity * 100).toFixed(1)}%\n`;
            }
            context += `\n`;
          });
        } else {
          context += 'Контесты по вашему запросу не найдены.\n';
        }
      } catch (e) {
        console.warn('Ошибка векторного поиска контестов:', e);
        context += 'Не удалось выполнить семантический поиск контестов.\n';
      }
    }

    return context.trim();
  } catch (error) {
    console.error('RAG Error:', error);
    return 'Не удалось загрузить информацию. Попробуйте позже.';
  }
}