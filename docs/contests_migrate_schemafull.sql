-- contests: в таблицу попадали поля вне схемы, потому что при DEFINE TABLE ... SCHEMALESS
-- SurrealDB сохраняет любые атрибуты записи. После перехода на SCHEMAFULL необъявленные
-- поля не принимаются при создании/обновлении (лишнее отбрасывается).
--
-- Выполнить на нужном namespace/database (USE ... при необходимости).

ALTER TABLE contests SCHEMAFULL;
