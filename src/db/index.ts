import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';

type AnyDb = any;
const g = globalThis as unknown as { __db?: Promise<AnyDb> };

async function init(): Promise<AnyDb> {
  const migrationsFolder = path.join(process.cwd(), 'drizzle');
  let db: AnyDb;
  if (process.env.DATABASE_URL) {
    const { default: postgres } = await import('postgres');
    const { drizzle } = await import('drizzle-orm/postgres-js');
    const { migrate } = await import('drizzle-orm/postgres-js/migrator');
    db = drizzle(postgres(process.env.DATABASE_URL, { max: 5 }), { schema });
    await migrate(db, { migrationsFolder });
  } else {
    fs.mkdirSync(path.join(process.cwd(), '.data'), { recursive: true });
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle } = await import('drizzle-orm/pglite');
    const { migrate } = await import('drizzle-orm/pglite/migrator');
    db = drizzle(new PGlite(path.join(process.cwd(), '.data', 'pglite')), { schema });
    await migrate(db, { migrationsFolder });
  }
  const { seedIfEmpty, seedCatalogueOnce } = await import('./seed');
  await seedIfEmpty(db);
  await seedCatalogueOnce(db);
  return db;
}
export function getDb(): Promise<AnyDb> { return (g.__db ??= init()); }
export { schema };
