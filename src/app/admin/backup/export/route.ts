import { requireStaff } from '@/lib/auth';
import { getDb } from '@/db';
import { exportAll } from '@/lib/backup';
import { logAction } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export async function GET() {
  const u = await requireStaff('staff.manage'); // full admins only
  const buf = await exportAll(await getDb());
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'backup.download', 'backup', '', { bytes: buf.length });
  const d = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(buf), { headers: { 'content-type': 'application/gzip', 'content-disposition': `attachment; filename="fleurie-backup-${d}.json.gz"`, 'cache-control': 'no-store' } });
}
