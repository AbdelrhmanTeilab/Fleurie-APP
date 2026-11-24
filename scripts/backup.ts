// Usage: bun scripts/backup.ts [output-folder]   (works on the configured database; schedule it daily on the server)
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '../src/db';
import { exportAll } from '../src/lib/backup';
const dir = process.argv[2] || 'backups'; fs.mkdirSync(dir, { recursive: true });
const f = path.join(dir, `fleurie-backup-${new Date().toISOString().slice(0, 10)}.json.gz`);
fs.writeFileSync(f, await exportAll(await getDb())); console.log('Saved', f);
const old = fs.readdirSync(dir).filter(x => x.startsWith('fleurie-backup-')).sort().slice(0, -14); for (const o of old) fs.unlinkSync(path.join(dir, o));
process.exit(0);
