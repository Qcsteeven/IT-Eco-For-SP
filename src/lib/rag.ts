// src/lib/rag.ts
import { getDB } from "@/lib/surreal/surreal";

// Типы для данных из SurrealDB
interface NewsItem {
  id: any; // Может быть строкой или объектом _RecordId
  title: string;
  content: string;
  publish_date: string;
  registration_link?: string;
}

interface Contest {
  id: any; // Может быть строкой или объектом _RecordId
  title: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;
}

export async function getRagContext(query: string | undefined): Promise<string> {
  const safeQuery = (query ?? '').trim().toLowerCase();
  
  // Базовые ответы
  if (safeQuery.includes('дедлайн')) {
    return 'Дедлайн по задаче "AI-агент" — 14 декабря 2025.';
  }
  if (safeQuery.includes('rag')) {
    return 'RAG (Retrieval-Augmented Generation) — метод, при котором к запросу добавляется релевантный контекст из базы знаний.';
  }

  // Извлечение даты из запроса
  const dateMatch = safeQuery.match(/(\d{1,2})[ .-](\d{1,2})[ .-](\d{2,4})/);
  let targetDate = '';
  
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = dateMatch[2].padStart(2, '0');
    const year = dateMatch[3].length === 2 ? `20${dateMatch[3]}` : dateMatch[3];
    targetDate = `${year}-${month}-${day}`;
  }

  try {
    const db = await getDB();
    const now = new Date().toISOString();
    let context = '';

    // 1. Обработка новостей
    if (safeQuery.includes('новости') || safeQuery.includes('новость')) {
      let newsQuery = '';
      const params: Record<string, string> = {};

      if (dateMatch) {
        newsQuery = `SELECT * FROM news WHERE string::slice(publish_date, 0, 10) = $targetDate`;
        params.targetDate = targetDate;
      } else if (safeQuery.includes('последние') || safeQuery.includes('свежие')) {
        newsQuery = `SELECT * FROM news ORDER BY publish_date DESC LIMIT 5`;
      } else {
        // По умолчанию последние новости
        newsQuery = `SELECT * FROM news ORDER BY publish_date DESC LIMIT 5`;
      }

      const newsResult = await db.query(newsQuery, params);
      
      // Корректная типизация результата
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

    // 2. Обработка контестов
    if (safeQuery.includes('контест') || safeQuery.includes('соревновани')) {
      let contestQuery = '';
      let contestType = 'Актуальные контесты';
      const params: Record<string, string> = { now };

      if (safeQuery.includes('будущие') || safeQuery.includes('предстоящие')) {
        contestQuery = `SELECT * FROM contests 
                        WHERE status != 'Finished' 
                        AND end_time_utc > $now 
                        ORDER BY start_time_utc ASC 
                        LIMIT 5`;
        contestType = 'Будущие контесты';
      } 
      else if (safeQuery.includes('прошедшие') || safeQuery.includes('завершенные')) {
        contestQuery = `SELECT * FROM contests 
                        WHERE status = 'Finished' 
                        OR end_time_utc < $now 
                        ORDER BY end_time_utc DESC 
                        LIMIT 5`;
        contestType = 'Прошедшие контесты';
      } 
      else if (dateMatch) {
        contestQuery = `SELECT * FROM contests 
                        WHERE string::slice(start_time_utc, 0, 10) = $targetDate 
                        OR string::slice(end_time_utc, 0, 10) = $targetDate`;
        params.targetDate = targetDate;
        contestType = `Контесты за ${targetDate.split('-').reverse().join('.')}`;
      } 
      else {
        contestQuery = `SELECT * FROM contests 
                        ORDER BY start_time_utc DESC 
                        LIMIT 5`;
      }

      if (contestQuery) {
        const contestResult = await db.query(contestQuery, params);
        
        // Корректная типизация результата
        const contests: Contest[] = Array.isArray(contestResult) && contestResult.length > 0 
          ? (contestResult[0] as Contest[]) 
          : [];
        console.log(contests)
        if (contests.length > 0) {
          context += `${contestType}:\n`;
          contests.forEach((contest) => {
            const start = contest.start_time_utc
              ? new Date(contest.start_time_utc).toLocaleString('ru-RU')
              : 'Неизвестное время начала';
            
            const end = contest.end_time_utc
              ? new Date(contest.end_time_utc).toLocaleString('ru-RU')
              : 'Неизвестное время окончания';
            
            context += `- ${contest.title || 'Без названия'} (${contest.platform || 'Неизвестная платформа'})\n`;
            context += `  Статус: ${contest.status || 'Неизвестно'}\n`;
            context += `  Время: ${start} - ${end}\n`;
            context += `  Регистрация: ${contest.registration_link?.trim() || 'Ссылка отсутствует'}\n\n`;
          });
        }
      }
    }
    console.log(context.trim())
    return context.trim();
  } catch (error) {
    console.error('RAG Error:', error);
    return 'Не удалось загрузить информацию. Попробуйте позже.';
  }
}