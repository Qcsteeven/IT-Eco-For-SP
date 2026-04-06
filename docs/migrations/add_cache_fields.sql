-- Миграция: добавление полей кэширования для ускорения загрузки профиля
-- Дата: 2026-04-06
-- Описание: Добавлены поля для кэширования данных внешних API (TTL 1 час)

-- Обновляем все записи external_accounts, добавляя поля кэша
UPDATE external_accounts SET 
  cached_history = NONE,
  cached_rating = NONE,
  cached_user_info = NONE,
  cached_submissions = NONE,
  cached_karma = NONE,
  updated_at = time::now()
WHERE cached_history IS NONE;

-- Индекс для быстрого поиска по platform_name
DEFINE INDEX idx_external_accounts_platform ON external_accounts FIELDS platform_name;
