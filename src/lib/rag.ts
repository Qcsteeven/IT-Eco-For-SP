import { getDB } from "@/lib/surreal/surreal";
import { getEmbedding } from "@/lib/embedding";

interface NewsItem {
  id: unknown;
  title: string;
  content: string;
  publish_date: string;
  registration_link?: string;
}

interface Contest {
  id: unknown;
  title: string;
  name?: string;
  platform: string;
  status: string;
  start_time_utc: string;
  end_time_utc: string;
  registration_link: string;
  similarity?: number;
  type?: string;
}

/**
 * Извлекает фильтры из пользовательского запроса
 */
function extractFilters(query: string) {
  const lowerQuery = query.toLowerCase();
  
  const filters: {
    platform?: string;
    status?: 'upcoming' | 'past' | 'running';
    month?: number; // 0-11
    year?: number;
    durationType?: 'short' | 'standard' | 'long';
  } = {};

  // === Платформа ===
  const platforms = [
    { keywords: ['codeforces', 'кодфорсес', 'кф'], name: 'Codeforces' },
    { keywords: ['atcoder', 'аткодер'], name: 'AtCoder' },
    { keywords: ['leetcode', 'литкод'], name: 'LeetCode' },
    { keywords: ['topcoder', 'топкодер'], name: 'TopCoder' },
    { keywords: ['hackerrank', 'хакерранк'], name: 'HackerRank' },
    { keywords: ['codechef', 'кодшеф'], name: 'CodeChef' },
  ];
  
  for (const platform of platforms) {
    if (platform.keywords.some(kw => lowerQuery.includes(kw))) {
      filters.platform = platform.name;
      break;
    }
  }

  // === Статус (время относительно сейчас) ===
  const pastKeywords = ['прош', 'прошедш', 'заверш', 'прошедшие', 'прошедших', 'были', 'past', 'finished', 'ended', 'completed'];
  const upcomingKeywords = ['будущ', 'предстоящ', 'скоро', 'будущие', 'будущих', 'upcoming', 'future', 'soon'];
  const runningKeywords = ['текущ', 'сейчас', 'идущ', 'открыт', 'running', 'ongoing', 'current', 'active', 'open'];
  
  if (pastKeywords.some(kw => lowerQuery.includes(kw))) {
    filters.status = 'past';
  } else if (runningKeywords.some(kw => lowerQuery.includes(kw))) {
    filters.status = 'running';
  } else if (upcomingKeywords.some(kw => lowerQuery.includes(kw))) {
    filters.status = 'upcoming';
  }

  // === Месяц ===
  const monthNamesRu = [
    'январ', 'феврал', 'март', 'апрел', 'ма', 'июн',
    'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'
  ];
  const monthNamesEn = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  
  // Поиск по русским названиям
  for (let i = 0; i < monthNamesRu.length; i++) {
    if (lowerQuery.includes(monthNamesRu[i])) {
      filters.month = i;
      break;
    }
  }
  
  // Поиск по английским названиям (если не нашли по русским)
  if (filters.month === undefined) {
    for (let i = 0; i < monthNamesEn.length; i++) {
      if (lowerQuery.includes(monthNamesEn[i])) {
        filters.month = i;
        break;
      }
    }
  }
  
  // Поиск по номеру месяца (1-12)
  if (filters.month === undefined) {
    const monthMatch = lowerQuery.match(/\b([1-9]|10|11|12)\s*(месяц|мес|month)?\b/i);
    if (monthMatch) {
      const monthNum = parseInt(monthMatch[1]);
      if (monthNum >= 1 && monthNum <= 12) {
        filters.month = monthNum - 1;
      }
    }
  }

  // === Год ===
  const yearMatch = lowerQuery.match(/\b(202[4-9]|203[0-9])\b/);
  if (yearMatch) {
    filters.year = parseInt(yearMatch[1]);
  }

  // === Длительность ===
  if (lowerQuery.includes('коротк') || lowerQuery.includes('short') || lowerQuery.includes('быстр')) {
    filters.durationType = 'short';
  } else if (lowerQuery.includes('длинн') || lowerQuery.includes('long') || lowerQuery.includes('extended')) {
    filters.durationType = 'long';
  }

  return filters;
}

/**
 * Строит WHERE-условие для SurrealDB на основе фильтров
 */
function buildWhereClause(filters: ReturnType<typeof extractFilters>): string {
  const conditions: string[] = [];

  if (filters.platform) {
    conditions.push(`platform = '${filters.platform}'`);
  }

  if (filters.status) {
    const now = new Date().toISOString();
    if (filters.status === 'upcoming') {
      conditions.push(`start_time_utc > d'${now}'`);
    } else if (filters.status === 'past') {
      conditions.push(`end_time_utc < d'${now}'`);
    } else if (filters.status === 'running') {
      // Используем Open вместо Running (так принято в БД)
      conditions.push(`start_time_utc <= d'${now}' AND end_time_utc >= d'${now}'`);
    }
  }

  if (filters.month !== undefined) {
    const year = filters.year || new Date().getFullYear();
    const monthStart = new Date(Date.UTC(year, filters.month, 1)).toISOString();
    const monthEnd = new Date(Date.UTC(year, filters.month + 1, 0, 23, 59, 59)).toISOString();
    conditions.push(`start_time_utc >= d'${monthStart}' AND start_time_utc <= d'${monthEnd}'`);
  } else if (filters.year) {
    // Если год указан без месяца, фильтруем весь год
    const yearStart = new Date(Date.UTC(filters.year, 0, 1)).toISOString();
    const yearEnd = new Date(Date.UTC(filters.year, 11, 31, 23, 59, 59)).toISOString();
    conditions.push(`start_time_utc >= d'${yearStart}' AND start_time_utc <= d'${yearEnd}'`);
  }

  return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
}

/**
 * Создаёт оптимизированный поисковый запрос для эмбеддинга
 * Добавляет контекстные ключевые слова для лучшего поиска
 */
function buildQueryForEmbedding(query: string, filters: ReturnType<typeof extractFilters>): string {
  const parts: string[] = [query];

  // Добавляем контекст на основе извлечённых фильтров
  if (filters.platform) {
    parts.push(`platform: ${filters.platform}`);
  }

  if (filters.status) {
    if (filters.status === 'upcoming') {
      parts.push('upcoming future contest soon');
    } else if (filters.status === 'past') {
      parts.push('past finished ended contest');
    } else if (filters.status === 'running') {
      parts.push('running ongoing current active contest');
    }
  }

  if (filters.month !== undefined) {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    parts.push(`month: ${monthNames[filters.month]}`);
  }

  if (filters.durationType) {
    parts.push(`duration: ${filters.durationType}`);
  }

  // Добавляем общие ключевые слова для контекста
  parts.push('programming contest competitive coding championship round');

  return parts.join(' | ');
}

export async function getRagContext(query: string | undefined): Promise<string> {
  const safeQuery = (query ?? '').trim();
  if (!safeQuery) return '';

  const lowerQuery = safeQuery.toLowerCase();

  // Базовые ответы на частые вопросы
  if (lowerQuery.includes('дедлайн')) {
    return 'Дедлайн по задаче "AI-агент" — 14 декабря 2025.';
  }
  if (lowerQuery.includes('rag')) {
    return 'RAG (Retrieval-Augmented Generation) — метод, при котором к запросу добавляется релевантный контекст из базы знаний.';
  }

  try {
    const db = await getDB();
    let context = '';

    // === Новости ===
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

    // === Контесты ===
    if (lowerQuery.includes('контест') || lowerQuery.includes('соревновани') || lowerQuery.includes('чемпионат') || lowerQuery.includes('турнир')) {
      try {
        // 1. Извлекаем фильтры из запроса
        const filters = extractFilters(safeQuery);
        
        // 2. Строим WHERE-условие
        const whereClause = buildWhereClause(filters);
        
        // 3. Создаём оптимизированный запрос для эмбеддинга
        const queryForEmbedding = buildQueryForEmbedding(safeQuery, filters);
        
        // 4. Генерируем эмбеддинг
        const queryEmbedding = await getEmbedding(queryForEmbedding);

        // 5. Выполняем гибридный поиск (векторный + фильтрация)
        const contestQuery = `
          SELECT
            *,
            vector::similarity::cosine(embedding, $query_vector) AS similarity
          FROM contests
          ${whereClause}
          AND embedding <|20|> $query_vector
          ORDER BY similarity DESC
          LIMIT 10;
        `;

        const contestResult = await db.query(contestQuery, {
          query_vector: queryEmbedding
        });

        const contests: Contest[] = Array.isArray(contestResult) && contestResult.length > 0
          ? (contestResult[0] as Contest[])
          : [];

        if (contests.length > 0) {
          // Формируем заголовок с информацией о фильтрах
          const filterParts: string[] = [];
          if (filters.platform) filterParts.push(filters.platform);
          if (filters.status === 'upcoming') filterParts.push('предстоящие');
          if (filters.status === 'past') filterParts.push('прошедшие');
          if (filters.status === 'running') filterParts.push('текущие');
          if (filters.month !== undefined) {
            const monthNames = [
              'январе', 'феврале', 'марте', 'апреле', 'мае', 'июне',
              'июле', 'августе', 'сентябре', 'октябре', 'ноябре', 'декабре'
            ];
            filterParts.push(`в ${monthNames[filters.month]}`);
          }
          
          context += `🎯 Контесты${filterParts.length > 0 ? ' (' + filterParts.join(', ') + ')' : ''}:\n\n`;
          
          contests.forEach((contest, index) => {
            const start = contest.start_time_utc
              ? new Date(contest.start_time_utc).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Неизвестно';
            const end = contest.end_time_utc
              ? new Date(contest.end_time_utc).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Неизвестно';

            const title = contest.title || contest.name || 'Без названия';
            const platform = contest.platform || 'Codeforces';
            const type = contest.type ? `(${contest.type})` : '';

            context += `${index + 1}. ${title} ${type}\n`;
            context += `   Платформа: ${platform}\n`;
            context += `   Время: ${start} – ${end}\n`;
            context += `   Регистрация: ${contest.registration_link?.trim() || '—'}\n`;
            if (contest.similarity !== undefined) {
              context += `   Релевантность: ${(contest.similarity * 100).toFixed(1)}%\n`;
            }
            context += `\n`;
          });
        } else {
          // Если ничего не найдено, пробуем без фильтров
          if (Object.keys(filters).length > 0) {
            context += 'По заданным фильтрам ничего не найдено. Попробую расширить поиск...\n\n';
            
            const queryEmbedding = await getEmbedding(buildQueryForEmbedding(safeQuery, {}));
            const fallbackResult = await db.query(
              `
              SELECT *, vector::similarity::cosine(embedding, $query_vector) AS similarity
              FROM contests
              WHERE embedding <|20|> $query_vector
              ORDER BY similarity DESC
              LIMIT 5;
              `,
              { query_vector: queryEmbedding }
            );

            const fallbackContests: Contest[] = Array.isArray(fallbackResult) && fallbackResult.length > 0
              ? (fallbackResult[0] as Contest[])
              : [];

            if (fallbackContests.length > 0) {
              context += '🎯 Другие контесты:\n\n';
              fallbackContests.forEach((contest, index) => {
                const start = contest.start_time_utc
                  ? new Date(contest.start_time_utc).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Неизвестно';
                const end = contest.end_time_utc
                  ? new Date(contest.end_time_utc).toLocaleString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })
                  : 'Неизвестно';

                const title = contest.title || contest.name || 'Без названия';
                const platform = contest.platform || 'Codeforces';

                context += `${index + 1}. ${title}\n`;
                context += `   Платформа: ${platform}\n`;
                context += `   Время: ${start} – ${end}\n`;
                context += `   Регистрация: ${contest.registration_link?.trim() || '—'}\n\n`;
              });
            } else {
              context += 'Контесты не найдены.\n';
            }
          } else {
            context += 'Контесты не найдены.\n';
          }
        }
      } catch (e) {
        console.warn('Ошибка поиска контестов:', e);
        context += 'Не удалось выполнить поиск контестов.\n';
      }
    }

    return context.trim();
  } catch (error) {
    console.error('RAG Error:', error);
    return 'Не удалось загрузить информацию. Попробуйте позже.';
  }
}
