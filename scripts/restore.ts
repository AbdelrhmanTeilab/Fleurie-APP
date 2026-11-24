// Usage: bun scripts/restore.ts path/to/fleurie-backup-YYYY-MM-DD.json.gz   (REPLACES all data in the configured database)
import fs from 'node:fs';
import { getDb } from '../src/db';
import { importAll } from '../src/lib/backup';
const file = process.argv[2]; if (!file || !fs.existsSync(file)) { console.error('Usage: bun scripts/restore.ts <backup-file>'); process.exit(1); }
const r = await importAll(await getDb(), fs.readFileSync(file)); console.log('Restored', r); process.exit(0);
