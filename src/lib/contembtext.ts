/**
 * Создаёт обогащённый текст для эмбеддинга контеста.
 * Включает ключевые слова для лучшего поиска по запросам:
 * - "будущие/предстоящие контесты"
 * - "прошедшие/завершённые контесты"
 * - "контесты в апреле/марте" (по месяцу)
 * - "контесты от Codeforces/AtCoder" (по платформе)
 * - "короткие/длинные контесты" (по длительности)
 */
export async function buildContestEmbeddingText(contest: Record<string, unknown>): Promise<string> {
  const startTimeSeconds = contest.startTimeSeconds as number;
  const durationSeconds = contest.durationSeconds as number;
  const contestType = contest.type as string | undefined;
  const contestName = contest.name as string | undefined;
  const contestPlatform = contest.platform as string | undefined;
  
  const start = new Date(startTimeSeconds * 1000);
  const durationMinutes = Math.floor(durationSeconds / 60);
  const durationHours = Math.floor(durationMinutes / 60);
  const remainingMinutes = durationMinutes % 60;

  let durationStr = '';
  if (durationHours > 0) {
    durationStr += `${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
    if (remainingMinutes > 0) {
      durationStr += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  } else {
    durationStr = `${durationMinutes} minute${durationMinutes !== 1 ? 's' : ''}`;
  }

  const startDate = start.toISOString().split('T')[0];
  const startTimeUTC = start.toISOString().slice(11, 16);
  
  // Месяц проведения (для поиска по месяцу)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthName = monthNames[start.getMonth()];
  const monthRu = start.toLocaleDateString('ru-RU', { month: 'long' });
  
  // День недели
  const dayOfWeek = start.toLocaleDateString('ru-RU', { weekday: 'long' });
  
  // Тип длительности
  let durationType = 'standard';
  if (durationMinutes < 60) durationType = 'short';
  else if (durationMinutes > 180) durationType = 'long';
  
  // Платформа
  const platform = (contestPlatform as string) || 'Codeforces';
  const platformLower = platform.toLowerCase();

  return [
    // Основная информация
    contestName || 'Untitled Contest',
    `Platform: ${contestPlatform || 'Codeforces'}`,
    `Type: ${contestType || 'CF'}`,
    `Start date: ${startDate}`,
    `Start time UTC: ${startTimeUTC}`,
    `Duration: ${durationStr}`,
    `Status: upcoming`,
    
    // Ключевые слова для поиска (на русском и английском)
    `month: ${monthName}, ${monthRu}`,
    `day: ${dayOfWeek}`,
    `duration_type: ${durationType}`,
    
    // Синонимы и ключевые фразы для поиска
    `keywords: будущий контест, предстоящий контест, upcoming contest, future contest, ${platformLower} соревнование, ${platformLower} конкурс, programming contest, competitive programming`,
    `search_phrases: контесты в ${monthRu}, контесты в ${monthName.toLowerCase()}, ${dayOfWeek} контест, ${durationType} duration contest`
  ].join(' | ');
}