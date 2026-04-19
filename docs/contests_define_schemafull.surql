-- Полное определение таблицы contests (SCHEMAFULL). Для новой БД или после REMOVE TABLE contests.
-- На уже существующую таблицу с данными достаточно docs/contests_migrate_schemafull.sql

DEFINE TABLE contests SCHEMAFULL TYPE ANY PERMISSIONS NONE;

-- ------------------------------
-- FIELDS
-- ------------------------------

DEFINE FIELD embedding ON contests TYPE array<float> ASSERT $value.len() = 1024 PERMISSIONS FULL;
DEFINE FIELD embedding[*] ON contests TYPE float PERMISSIONS FULL;
DEFINE FIELD end_time_utc ON contests TYPE datetime PERMISSIONS FULL;
DEFINE FIELD name ON contests TYPE string PERMISSIONS FULL;
DEFINE FIELD platform ON contests TYPE string PERMISSIONS FULL;
DEFINE FIELD platform_contest_id ON contests TYPE string PERMISSIONS FULL;
DEFINE FIELD registration_link ON contests TYPE string PERMISSIONS FULL;
DEFINE FIELD start_time_utc ON contests TYPE datetime ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD status ON contests TYPE string DEFAULT 'Soon' ASSERT $value INSIDE ['Open', 'Soon', 'Finished'] PERMISSIONS FULL;
DEFINE FIELD title ON contests TYPE string ASSERT $value != NONE PERMISSIONS FULL;
DEFINE FIELD updated_at ON contests TYPE datetime PERMISSIONS FULL;

-- ------------------------------
-- INDEXES
-- ------------------------------

DEFINE INDEX idx_contests_embedding ON contests FIELDS embedding MTREE DIMENSION 1024 DIST COSINE TYPE F32 CAPACITY 40 DOC_IDS_ORDER 100 DOC_IDS_CACHE 100 MTREE_CACHE 100;
