/**
 * Однократно: ALTER TABLE contests SCHEMAFULL (см. docs/contests_migrate_schemafull.sql).
 * Запуск из корня репозитория: npx tsx tools/migrate-contests-schemafull.ts
 */
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

async function main() {
  const { getDB, resetConnection } = await import('../src/lib/surreal/surreal');
  const db = await getDB();
  await db.query('ALTER TABLE contests SCHEMAFULL;');
  console.log('ALTER TABLE contests SCHEMAFULL — выполнено');
  await resetConnection();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
