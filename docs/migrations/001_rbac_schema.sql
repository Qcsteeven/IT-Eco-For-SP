-- ==========================================
-- RBAC Migration Script for SurrealDB
-- Создание схемы ролей и разрешений
-- ==========================================

-- Определяем таблицу пользователей с RBAC
DEFINE TABLE users SCHEMAFULL
    PERMISSIONS
        -- Пользователи могут читать только свои данные
        SELECT WHERE id = $auth.id
        -- Только администраторы могут обновлять пользователей
        UPDATE WHERE $auth.role = 'admin'
        -- Только администраторы могут удалять пользователей
        DELETE WHERE $auth.role = 'admin'
        -- Создание разрешено для всех (регистрация)
        CREATE WHERE true;

-- Определяем поля таблицы users
DEFINE FIELD email ON users TYPE string
    ASSERT string::is::email($value)
    ASSERT array::len(array::select::from(users WHERE email = $value)) == 0;

DEFINE FIELD password_hash ON users TYPE string
    ASSERT string::len($value) >= 60;

DEFINE FIELD role ON users TYPE string
    DEFAULT 'user'
    ASSERT $value IN ['guest', 'user', 'coach', 'admin'];

DEFINE FIELD is_verified ON users TYPE bool
    DEFAULT false;

DEFINE FIELD full_name ON users TYPE option<string>;

DEFINE FIELD registration_date ON users TYPE datetime
    DEFAULT time::now();

DEFINE FIELD karma ON users TYPE number
    DEFAULT 0;

DEFINE FIELD codeforces_handle ON users TYPE option<string>;

DEFINE FIELD atcoder_handle ON users TYPE option<string>;

-- ==========================================
-- Таблица контестов с RBAC
-- ==========================================

DEFINE TABLE contests SCHEMAFULL
    PERMISSIONS
        -- Все могут читать контесты
        SELECT WHERE true
        -- Только coach и admin могут создавать/обновлять/удалять
        CREATE WHERE $auth.role IN ['coach', 'admin']
        UPDATE WHERE $auth.role IN ['coach', 'admin']
        DELETE WHERE $auth.role IN ['coach', 'admin'];

DEFINE FIELD name ON contests TYPE string;

DEFINE FIELD platform ON contests TYPE string
    ASSERT $value IN ['codeforces', 'atcoder', 'custom'];

DEFINE FIELD start_time ON contests TYPE datetime;

DEFINE FIELD duration ON contests TYPE number
    ASSERT $value > 0;

DEFINE FIELD status ON contests TYPE string
    DEFAULT 'upcoming'
    ASSERT $value IN ['upcoming', 'active', 'completed'];

DEFINE FIELD created_by ON users TYPE option<record<users>>;

DEFINE FIELD created_at ON contests TYPE datetime
    DEFAULT time::now();

-- ==========================================
-- Таблица логов изменений кармы
-- ==========================================

DEFINE TABLE karma_logs SCHEMAFULL
    PERMISSIONS
        -- Только admin может читать логи
        SELECT WHERE $auth.role = 'admin'
        -- Только admin может создавать логи
        CREATE WHERE $auth.role = 'admin'
        -- Обновление и удаление запрещены
        UPDATE WHERE false
        DELETE WHERE false;

DEFINE FIELD user ON karma_logs TYPE record<users>;

DEFINE FIELD amount ON karma_logs TYPE number;

DEFINE FIELD reason ON karma_logs TYPE string;

DEFINE FIELD admin_id ON karma_logs TYPE record<users>;

DEFINE FIELD created_at ON karma_logs TYPE datetime
    DEFAULT time::now();

-- ==========================================
-- Таблица внешних аккаунтов (Codeforces/AtCoder)
-- ==========================================

DEFINE TABLE external_accounts SCHEMAFULL
    PERMISSIONS
        -- Пользователи могут читать только свои аккаунты
        SELECT WHERE user = $auth.id
        -- Admin может читать все
        SELECT WHERE $auth.role = 'admin'
        -- Пользователи могут управлять своими аккаунтами
        CREATE WHERE user = $auth.id
        UPDATE WHERE user = $auth.id OR $auth.role = 'admin'
        DELETE WHERE user = $auth.id OR $auth.role = 'admin';

DEFINE FIELD user ON external_accounts TYPE record<users>;

DEFINE FIELD platform ON external_accounts TYPE string
    ASSERT $value IN ['codeforces', 'atcoder'];

DEFINE FIELD handle ON external_accounts TYPE string;

DEFINE FIELD rating ON external_accounts TYPE option<number>
    DEFAULT 0;

DEFINE FIELD last_updated ON external_accounts TYPE datetime
    DEFAULT time::now();

DEFINE FIELD cache_data ON external_accounts TYPE option<string>
    DEFAULT null;

-- ==========================================
-- Индексы для оптимизации запросов RBAC
-- ==========================================

DEFINE INDEX idx_users_role ON users FIELDS role;
DEFINE INDEX idx_users_email ON users FIELDS email UNIQUE;
DEFINE INDEX idx_contests_status ON contests FIELDS status;
DEFINE INDEX idx_contests_platform ON contests FIELDS platform;
DEFINE INDEX idx_karma_logs_user ON karma_logs FIELDS user;
DEFINE INDEX idx_karma_logs_admin ON karma_logs FIELDS admin_id;
DEFINE INDEX idx_external_accounts_user ON external_accounts FIELDS user;
DEFINE INDEX idx_external_accounts_platform ON external_accounts FIELDS platform;

-- ==========================================
-- Создание начального администратора (опционально)
-- ==========================================
-- Раскомментируйте и измените значения для создания первого администратора
-- CREATE users:admin_initial SET
--     email = 'admin@example.com',
--     password_hash = '$2b$10$YourHashHere',
--     role = 'admin',
--     is_verified = true,
--     full_name = 'System Administrator',
--     registration_date = time::now();

-- ==========================================
-- Валидация миграции
-- ==========================================

-- Проверка, что таблица созданы корректно
-- INFO FOR TABLE users;
-- INFO FOR TABLE contests;
-- INFO FOR TABLE karma_logs;
-- INFO FOR TABLE external_accounts;

-- Проверка индексов
-- INFO FOR INDEX idx_users_role;
-- INFO FOR INDEX idx_contests_status;
