import type { CodeforcesSubmission } from '@/types/codeforces';

/**
 * Конфигурация весов по умолчанию для расчета кармы
 *
 * Логика расчета:
 * 1. Базовая карма за каждую решенную задачу в зависимости от сложности
 */
export const DEFAULT_KARMA_WEIGHTS = {
  // Базовые веса за сложность (за каждую задачу)
  easyWeight: 1, // < 1200 rating
  mediumWeight: 3, // 1200-2000 rating
  hardWeight: 10, // 2000+ rating
};

/**
 * Получить множитель для задачи на основе её тегов
 * Всегда возвращает 1.0 (теги не влияют на карму)
 */
export function getTagMultiplier(_tags: string[]): number {
  return 1.0;
}

/**
 * Определить сложность задачи по рейтингу
 */
function getDifficulty(rating: number): 'easy' | 'medium' | 'hard' {
  if (rating < 1200) return 'easy';
  if (rating < 2000) return 'medium';
  return 'hard';
}

/**
 * Получить базовый вес для сложности задачи
 */
function getBaseWeight(difficulty: 'easy' | 'medium' | 'hard'): number {
  switch (difficulty) {
    case 'easy':
      return DEFAULT_KARMA_WEIGHTS.easyWeight;
    case 'medium':
      return DEFAULT_KARMA_WEIGHTS.mediumWeight;
    case 'hard':
      return DEFAULT_KARMA_WEIGHTS.hardWeight;
  }
}

/**
 * Рассчитать карму пользователя на основе решенных задач
 *
 * @param submissions - Список решенных задач пользователя
 * @param problemRatings - Маппинг ID задачи -> рейтинг
 * @param problemTags - Маппинг ID задачи -> теги
 * @returns Объект с результатами расчета кармы
 */
export function calculateKarma(
  submissions: CodeforcesSubmission[],
  problemRatings: Map<string, number>,
  problemTags: Map<string, string[]>,
): KarmaResult {
  let totalKarma = 0;
  let easyKarma = 0;
  let mediumKarma = 0;
  let hardKarma = 0;
  let tagBonusKarma = 0;

  const allTags = new Set<string>();
  let totalRating = 0;
  let ratedCount = 0;

  // Обрабатываем каждую задачу
  for (const submission of submissions) {
    const key = submission.contestId
      ? `${submission.contestId}-${submission.problemIndex}`
      : submission.problemIndex;

    const rating = problemRatings.get(key) || 0;
    const tags = problemTags.get(key) || [];

    // Определяем сложность
    const difficulty = rating > 0 ? getDifficulty(rating) : 'easy';
    const baseWeight = getBaseWeight(difficulty);

    // Получаем множитель за теги
    const tagMultiplier = getTagMultiplier(tags);

    // Рассчитываем карму за задачу
    const problemKarma = baseWeight * tagMultiplier;

    // Добавляем бонус за задачу с контеста
    const contestBonus = submission.contestId
      ? DEFAULT_KARMA_WEIGHTS.contestProblemBonus
      : 0;

    const totalProblemKarma = problemKarma + contestBonus;

    // Распределяем по категориям
    switch (difficulty) {
      case 'easy':
        easyKarma += totalProblemKarma;
        break;
      case 'medium':
        mediumKarma += totalProblemKarma;
        break;
      case 'hard':
        hardKarma += totalProblemKarma;
        break;
    }

    totalKarma += totalProblemKarma;

    // Собираем статистику
    if (rating > 0) {
      totalRating += rating;
      ratedCount++;
    }

    tags.forEach((tag) => allTags.add(tag));
  }

  // Бонус за разнообразие тегов
  const diversityBonus =
    allTags.size * DEFAULT_KARMA_WEIGHTS.uniqueProblemTagBonus;
  totalKarma += diversityBonus;

  // Бонус за теги (дополнительный)
  tagBonusKarma = totalKarma - easyKarma - mediumKarma - hardKarma;

  return {
    totalKarma: Math.round(totalKarma),
    breakdown: {
      easyKarma: Math.round(easyKarma),
      mediumKarma: Math.round(mediumKarma),
      hardKarma: Math.round(hardKarma),
      tagBonusKarma: Math.round(tagBonusKarma),
      diversityBonus: Math.round(diversityBonus),
    },
    details: {
      totalSolved: submissions.length,
      easyCount: submissions.filter((s) => {
        const key = s.contestId
          ? `${s.contestId}-${s.problemIndex}`
          : s.problemIndex;
        const rating = problemRatings.get(key) || 0;
        return getDifficulty(rating) === 'easy';
      }).length,
      mediumCount: submissions.filter((s) => {
        const key = s.contestId
          ? `${s.contestId}-${s.problemIndex}`
          : s.problemIndex;
        const rating = problemRatings.get(key) || 0;
        return getDifficulty(rating) === 'medium';
      }).length,
      hardCount: submissions.filter((s) => {
        const key = s.contestId
          ? `${s.contestId}-${s.problemIndex}`
          : s.problemIndex;
        const rating = problemRatings.get(key) || 0;
        return getDifficulty(rating) === 'hard';
      }).length,
      averageRating: ratedCount > 0 ? Math.round(totalRating / ratedCount) : 0,
      uniqueTags: allTags.size,
    },
  };
}

/**
 * Упрощенная функция расчета кармы (без детализации)
 * Используется для быстрого расчета
 */
export function calculateSimpleKarma(
  easyCount: number,
  mediumCount: number,
  hardCount: number,
  averageRating: number = 0,
): number {
  const baseKarma =
    easyCount * DEFAULT_KARMA_WEIGHTS.easyWeight +
    mediumCount * DEFAULT_KARMA_WEIGHTS.mediumWeight +
    hardCount * DEFAULT_KARMA_WEIGHTS.hardWeight;

  // Бонус за средний рейтинг
  const ratingBonus = averageRating > 0 ? Math.floor(averageRating / 100) : 0;

  return Math.round(baseKarma + ratingBonus);
}

/**
 * Интерпретация уровня кармы
 */
export function getKarmaLevel(karma: number): string {
  if (karma < 50) return 'Новичок';
  if (karma < 150) return 'Начинающий';
  if (karma < 300) return 'Любитель';
  if (karma < 500) return 'Продвинутый';
  if (karma < 800) return 'Опытный';
  if (karma < 1200) return 'Эксперт';
  if (karma < 1700) return 'Профессионал';
  if (karma < 2300) return 'Мастер';
  return 'Легенда';
}

/**
 * Цвет для уровня кармы
 */
export function getKarmaColor(karma: number): string {
  if (karma < 50) return '#808080'; // серый
  if (karma < 150) return '#008000'; // зеленый
  if (karma < 300) return '#0000FF'; // синий
  if (karma < 500) return '#00FFFF'; // голубой
  if (karma < 800) return '#FFA500'; // оранжевый
  if (karma < 1200) return '#FF0000'; // красный
  if (karma < 1700) return '#FF00FF'; // фиолетовый
  if (karma < 2300) return '#FFD700'; // золотой
  return '#FF4500'; // оранжево-красный
}
