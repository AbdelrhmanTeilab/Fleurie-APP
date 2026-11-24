import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core';
import { getTableName, is, sql } from 'drizzle-orm';
import { PgTable as PgT } from 'drizzle-orm/pg-core';
import * as schema from '../db/schema';

const UPLOADS = () => path.join(process.cwd(), 'uploads');
const tables = () => Object.values(schema).filter((t: any) => is(t, PgT)) as PgTable[];
// Parents first, so rows can be inserted without breaking foreign keys.
function ordered(): PgTable[] {
  const all = tables(), done = new Set<string>(), out: PgTable[] = [];
  const visit = (t: PgTable) => { const n = getTableName(t); if (done.has(n)) return; done.add(n); for (const fk of getTableConfig(t).foreignKeys) { const ref = fk.reference().foreignTable as PgTable; if (getTableName(ref) !== n) visit(ref); } out.push(t); };
  all.forEach(visit); return out;
}
function walk(dir: string, base = ''): string[] { if (!fs.existsSync(dir)) return []; return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name), base + e.name + '/') : [base + e.name]); }

// One compressed file holding every table plus all uploaded images (including private payment proofs).
export async function exportAll(db: any): Promise<Buffer> {
  const data: Record<string, unknown[]> = {};
  for (const t of ordered()) data[getTableName(t)] = await db.select().from(t);
  const files: Record<string, string> = {}; // legacy: images now live in the 'files' table
  return gzipSync(Buffer.from(JSON.stringify({ app: 'fleurie', version: 1, createdAt: new Date().toISOString(), data, files })));
}

// Replaces EVERYTHING in the target database with the backup. Intended for a new/empty install or disaster recovery.
export async function importAll(db: any, buf: Buffer) {
  const b = JSON.parse(gunzipSync(buf).toString('utf8')); if (b.app !== 'fleurie') throw new Error('Not a Fleurie backup');
  const ord = ordered();
  await db.execute(sql.raw(`TRUNCATE ${ord.map(t => `"${getTableName(t)}"`).join(', ')} RESTART IDENTITY CASCADE`));
  for (const t of ord) {
    const rows: any[] = b.data[getTableName(t)] ?? []; if (!rows.length) continue;
    const cols = getTableConfig(t).columns;
    const revived = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === 'string' && isTs(t, k) ? new Date(v) : v])));
    for (let i = 0; i < revived.length; i += 200) await db.insert(t).values(revived.slice(i, i + 200));
    const serial = cols.find((c: any) => c.name === 'id'); if (serial) await db.execute(sql.raw(`SELECT setval(pg_get_serial_sequence('"${getTableName(t)}"', 'id'), COALESCE((SELECT MAX(id) FROM "${getTableName(t)}"), 1), (SELECT COUNT(*) > 0 FROM "${getTableName(t)}"))`)).catch(() => {});
  }
  for (const [f, b64] of Object.entries<string>(b.files ?? {})) { const p = path.join(UPLOADS(), path.normalize(f).replace(/^(\.\.[\\/])+/, '')); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, Buffer.from(b64, 'base64')); }
  return { tables: ord.length, rows: Object.values(b.data).reduce((a: number, r: any) => a + r.length, 0), files: Object.keys(b.files ?? {}).length };
}
// Row objects use property names (e.g. createdAt); find which properties are timestamps.
function isTs(t: PgTable, prop: string) { const col = (t as any)[prop]; return !!col && col.dataType === 'date'; }
