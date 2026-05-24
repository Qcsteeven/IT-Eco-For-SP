# DB — инициализация SurrealDB

## Зачем

SurrealDB — schemaless: таблицы создаются автоматически при первом `CREATE`.  
**Но векторный индекс на `contests.embedding` нужно создать вручную** — без него
RAG-поиск (`embedding <|20|> $vec`) работает как full-scan или падает.

## Запуск (один раз после первого `docker compose up -d surreal`)

```bash
# Из корня проекта на сервере:
docker run --rm \
  --network it-eco_default \
  -v "$(pwd)/db/init.surql:/init.surql:ro" \
  surrealdb/surrealdb:latest \
  import \
  --conn ws://surreal:8000 \
  --user admin \
  --pass <SURREAL_PASS из .env.local> \
  --ns bcsp \
  --db site \
  /init.surql
```

Или через удобный скрипт (читает `.env.local` сам):

```bash
bash db/migrate.sh
```

## Файлы

| Файл         | Назначение                                    |
| ------------ | --------------------------------------------- |
| `init.surql` | Индексы + HNSW-вектор на `contests.embedding` |
| `migrate.sh` | Обёртка для запуска `init.surql`              |

## Повторный запуск

Все команды используют `IF NOT EXISTS` — безопасно запускать сколько угодно раз.
