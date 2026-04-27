-- Миграция: создание отдельной таблицы events для мероприятий от админа/тренера
-- Дата: 2026-04-13
-- Описание: Таблица events отделена от contests (внешние контесты Codeforces/AtCoder)
-- Таблица events — это внутренние мероприятия, создаваемые тренерами

-- Создаём таблицу events
DEFINE TABLE events SCHEMAFULL;

-- Метаданные
DEFINE FIELD title ON events TYPE string;
DEFINE FIELD description ON events TYPE option<string>;
DEFINE FIELD platform ON events TYPE string;
DEFINE FIELD status ON events TYPE string;

-- Даты
DEFINE FIELD start_time_utc ON events TYPE datetime;
DEFINE FIELD end_time_utc ON events TYPE datetime;

-- Внешняя ссылка
DEFINE FIELD external_link ON events TYPE string;

-- Видимость и участники
DEFINE FIELD visibility_type ON events TYPE string;
DEFINE FIELD participant_list ON events TYPE array<string>;

-- Создатель
DEFINE FIELD created_by ON events TYPE option<record<users>>;

-- Временные метки
DEFINE FIELD created_at ON events TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at ON events TYPE datetime DEFAULT time::now();

-- Индексы
DEFINE INDEX idx_events_visibility ON events FIELDS visibility_type;
DEFINE INDEX idx_events_status ON events FIELDS status;
DEFINE INDEX idx_events_start_time ON events FIELDS start_time_utc;
