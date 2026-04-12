# SQL скрипт для удаления поля codeforces_karma из таблицы users
# Выполнить в SurrealDB CLI или через GUI

-- Удаляем поле codeforces_karma — теперь используется только total_karma
UPDATE users UNSET codeforces_karma;
