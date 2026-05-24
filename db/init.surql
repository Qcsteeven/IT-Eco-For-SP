-- =============================================================================
-- init.surql — одноразовая инициализация схемы SurrealDB для IT-Eco.
-- Запускать после первого старта SurrealDB (см. db/README.md).
-- Идемпотентен: безопасно запускать повторно.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ПОЛЬЗОВАТЕЛИ
-- ---------------------------------------------------------------------------

-- Уникальный email (авторизация, регистрация, восстановление пароля)
DEFINE INDEX IF NOT EXISTS users_email_idx
  ON TABLE users FIELDS email UNIQUE;

-- Быстрый поиск неподтверждённых аккаунтов
DEFINE INDEX IF NOT EXISTS users_verified_idx
  ON TABLE users FIELDS is_verified;

-- ---------------------------------------------------------------------------
-- КОНТЕСТЫ (contests)
-- Самая важная часть — векторный HNSW-индекс для RAG / AI-чата.
-- Модель: intfloat/multilingual-e5-large → 1024 измерения.
-- Без этого индекса запрос `embedding <|20|> $vec` работает как full-scan.
-- ---------------------------------------------------------------------------

DEFINE INDEX IF NOT EXISTS contests_embedding_idx
  ON TABLE contests FIELDS embedding
  HNSW DIMENSION 1024 DIST COSINE TYPE F32;

-- Фильтрация по платформе и дате в запросах каталога
DEFINE INDEX IF NOT EXISTS contests_platform_idx
  ON TABLE contests FIELDS platform;

DEFINE INDEX IF NOT EXISTS contests_start_idx
  ON TABLE contests FIELDS start_time_utc;

-- ---------------------------------------------------------------------------
-- ВНЕШНИЕ АККАУНТЫ (Codeforces, AtCoder)
-- ---------------------------------------------------------------------------

DEFINE INDEX IF NOT EXISTS ext_accounts_lookup_idx
  ON TABLE external_accounts FIELDS user_id, platform_name;

DEFINE INDEX IF NOT EXISTS ext_accounts_platform_idx
  ON TABLE external_accounts FIELDS platform_name;

-- ---------------------------------------------------------------------------
-- ГРУППЫ И УЧАСТНИКИ
-- ---------------------------------------------------------------------------

DEFINE INDEX IF NOT EXISTS group_members_group_idx
  ON TABLE group_members FIELDS group_id;

DEFINE INDEX IF NOT EXISTS group_members_user_idx
  ON TABLE group_members FIELDS user_id;

DEFINE INDEX IF NOT EXISTS group_coaches_group_idx
  ON TABLE group_coaches FIELDS group_id;

DEFINE INDEX IF NOT EXISTS group_coaches_coach_idx
  ON TABLE group_coaches FIELDS coach_id;

-- ---------------------------------------------------------------------------
-- СЕССИИ ЧАТА
-- ---------------------------------------------------------------------------

DEFINE INDEX IF NOT EXISTS chat_sessions_user_idx
  ON TABLE chat_sessions FIELDS user_id;

-- ---------------------------------------------------------------------------
-- ТОКЕНЫ СБРОСА ПАРОЛЯ
-- ---------------------------------------------------------------------------

DEFINE INDEX IF NOT EXISTS prt_token_idx
  ON TABLE password_reset_tokens FIELDS token UNIQUE;

-- ---------------------------------------------------------------------------
-- СОБЫТИЯ (events)
-- ---------------------------------------------------------------------------

DEFINE INDEX IF NOT EXISTS events_start_idx
  ON TABLE events FIELDS start_time_utc;
