# SQL скрипт для удаления поля atcoder_karma из таблицы users
# Выполнить в SurrealDB CLI или через GUI

-- Удаляем поле atcoder_karma из всех записей
-- Так как мы заменили его на total_karma, отдельное поле больше не нужно

UPDATE users UNSET atcoder_karma;

-- Примечание: В SurrealDB нет явного DROP COLUMN для schemaless таблиц.
-- UNSET удаляет поле из всех записей, что эквивалентно удалению колонки.
