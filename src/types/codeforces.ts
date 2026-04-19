// Типы для Codeforces API

/**
 * Объект пользователя Codeforces
 */
export interface CodeforcesUser {
  handle: string;
  rating?: number;
  rank?: string;
  maxRating?: number;
  contestCount?: number;
  firstName?: string;
  lastName?: string;
  country?: string;
  city?: string;
  organization?: string;
  contribution?: number;
  friendOfCount?: number;
  lastOnlineTimeSeconds?: number;
  registrationTimeSeconds?: number;
}

/**
 * Изменение рейтинга пользователя
 */
export interface CodeforcesRatingChange {
  contestId: number;
  contestName: string;
  rank: number;
  ratingUpdateTimeSeconds: number;
  oldRating: number;
  newRating: number;
}

/**
 * Статус решения (submission)
 */
export type VerdictType =
  | 'OK'
  | 'RUNTIME_ERROR'
  | 'WRONG_ANSWER'
  | 'PRESENTATION_ERROR'
  | 'TIME_LIMIT_EXCEEDED'
  | 'MEMORY_LIMIT_EXCEEDED'
  | 'COMPILATION_ERROR'
  | 'SKIPPED'
  | 'CHALLENGED'
  | 'HACKED'
  | 'PENDING'
  | 'PARTIALLY_CORRECT'
  | 'FAILED';

/**
 * Тип участника
 */
export type ParticipantType =
  | 'CONTESTANT'
  | 'PRACTICE'
  | 'VIRTUAL'
  | 'MANAGER'
  | 'OUT_OF_COMPETITION';

/**
 * Объект проблемы в submission
 */
export interface CodeforcesProblem {
  contestId?: number;
  index: string;
  name?: string;
  problemsetName?: string;
  points?: number;
  rating?: number;
  tags?: string[];
  type?: string;
}

/**
 * Объект решения (Submission) с Codeforces
 */
export interface CodeforcesSubmission {
  id: number;
  contestId?: number;
  problem?: CodeforcesProblem;
  problemIndex?: string; // Для обратной совместимости
  problemName?: string;
  verdict?: VerdictType;
  creationTimeSeconds: number;
  relativeTimeSeconds?: number;
  passedTestCount?: number;
  timeConsumedMillis?: number;
  memoryConsumedBytes?: number;
  participantType?: ParticipantType;
  languages?: string;
  testset?: string;
}

/**
 * Статистика решенных задач пользователя
 */
export interface CodeforcesProblemStats {
  totalSolved: number;
  easySolved: number; // rating < 1200
  mediumSolved: number; // 1200 <= rating < 2000
  hardSolved: number; // rating >= 2000
  averageRating: number;
  maxRating: number;
}

/**
 * Статистика по тегам задач
 */
export interface CodeforcesTagStats {
  tag: string;
  solvedCount: number;
  averageRating: number;
}

/**
 * Полная статистика пользователя Codeforces
 */
export interface CodeforcesFullStats {
  user: CodeforcesUser | null;
  submissions: CodeforcesSubmission[];
  ratingHistory: CodeforcesRatingChange[];
  problemStats: CodeforcesProblemStats;
  tagStats: CodeforcesTagStats[];
  karma: number;
}

/**
 * Параметры для расчета кармы
 */
export interface KarmaCalculationParams {
  submissions: CodeforcesSubmission[];
  problemRatings: Map<string, number>; // problemIndex -> rating
  problemTags: Map<string, string[]>; // problemIndex -> tags
}

/**
 * Конфигурация весов для расчета кармы
 */
export interface KarmaWeights {
  // Веса за сложность задачи
  easyWeight: number; // < 1200
  mediumWeight: number; // 1200-2000
  hardWeight: number; // 2000+

  // Множители за теги
  dpMultiplier: number; // Динамическое программирование
  graphsMultiplier: number; // Графы
  mathMultiplier: number; // Математика
  dataStructuresMultiplier: number; // Структуры данных
  greedyMultiplier: number; // Жадные алгоритмы
  defaultMultiplier: number; // Остальные теги

  // Бонусы
  uniqueProblemTagBonus: number; // Бонус за разнообразие тегов
  contestProblemBonus: number; // Бонус за задачи с контестов
}

/**
 * Результат расчета кармы
 */
export interface KarmaResult {
  totalKarma: number;
  breakdown: {
    easyKarma: number;
    mediumKarma: number;
    hardKarma: number;
    tagBonusKarma: number;
    diversityBonus: number;
  };
  details: {
    totalSolved: number;
    easyCount: number;
    mediumCount: number;
    hardCount: number;
    averageRating: number;
    uniqueTags: number;
  };
}
