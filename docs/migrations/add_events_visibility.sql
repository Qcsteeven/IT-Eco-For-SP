-- Миграция: мероприятия-ссылки с видимостью и участниками
-- Дата: 2026-04-12
-- Описание: Таблица contests расширена для поддержки:
--   - external_link: прямая ссылка на контест (Codeforces/AtCoder/etc)
--   - visibility_type: 'public' (для всех) или 'private' (только для назначенных)
--   - participant_list: массив ID пользователей, которым виден private контест
--   - created_by: ID пользователя (тренера/админа), создавшего мероприятие

-- Обновляем существующие записи, устанавливая значения по умолчанию
UPDATE contests SET
  external_link = registration_link,
  visibility_type = 'public',
  participant_list = [],
  created_by = NONE
WHERE visibility_type IS NONE;

-- Индекс для фильтрации по visibility_type
DEFINE INDEX idx_contests_visibility ON contests FIELDS visibility_type;

-- Индекс для поиска по participant_list (private контесты)
-- В SurrealDB можно искать по массивам: SELECT * FROM contests WHERE $userId IN participant_list
DEFINE INDEX idx_contests_participants ON contests FIELDS participant_list;

-- Примечание: SurrealDB schemaless, поля создаются автоматически.
-- Этот скрипт устанавливает значения по умолчанию для существующих записей.
