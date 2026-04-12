/**
 * Типы для системы мероприятий (мероприятия-ссылки)
 */

/** Тип видимости мероприятия */
export type EventVisibility = 'public' | 'private';

/** Статус мероприятия */
export type EventStatus = 'upcoming' | 'active' | 'completed' | 'cancelled';

/** Платформа мероприятия */
export type EventPlatform = 'codeforces' | 'atcoder' | 'custom' | 'other';

/** Мероприятие (contest/event) */
export interface Event {
  id: string;
  title: string;
  description?: string;
  platform: EventPlatform;
  status: EventStatus;
  start_time_utc: string;
  end_time_utc: string;
  /** Прямая ссылка на контест (Codeforces/AtCoder/etc) */
  external_link: string;
  /** Тип видимости: public — для всех, private — только для назначенных */
  visibility_type: EventVisibility;
  /** Массив ID пользователей, которым виден private контест */
  participant_list: string[];
  /** ID пользователя (тренера/админа), создавшего мероприятие */
  created_by?: string;
  /** ID контеста на внешней платформе */
  platform_contest_id?: string;
  /** Дата создания */
  created_at?: string;
  /** Дата последнего обновления */
  updated_at?: string;
}

/** Данные для создания/обновления мероприятия */
export interface CreateEventData {
  title: string;
  description?: string;
  platform: EventPlatform;
  status: EventStatus;
  start_time_utc: string;
  end_time_utc: string;
  external_link: string;
  visibility_type: EventVisibility;
  participant_list?: string[];
  platform_contest_id?: string;
}

export interface UpdateEventData extends Partial<CreateEventData> {
  id: string;
}

/** Фильтр для запроса событий */
export interface EventFilter {
  /** Если true — только мои назначенные события (для участника) */
  my_events?: boolean;
  /** Фильтр по платформе */
  platform?: EventPlatform;
  /** Фильтр по статусу */
  status?: EventStatus;
}
