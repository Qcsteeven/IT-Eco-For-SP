-- Миграция: добавить поддержку групп в events
-- Дата: 2026-04-20
-- Описание:
--  - target_groups: группы, которым назначено private мероприятие
--  - participant_snapshot: зафиксированный список участников (users:...), используемый для результатов

-- Группы-назначения (храним строковые thing-id вида groups:...)
DEFINE FIELD target_groups ON events TYPE option<array<string>>;

-- Снимок участников (строковые thing-id вида users:...)
DEFINE FIELD participant_snapshot ON events TYPE option<array<string>>;
-- Примечание: поля вида `target_groups[*]` / `participant_snapshot[*]` в некоторых БД
-- уже могли быть определены ранее. Они не обязательны для работы, поэтому тут не задаём.

-- (опционально) индекс по target_groups для ускорения выборок private по группам
DEFINE INDEX idx_events_target_groups ON events FIELDS target_groups;

