import { and, eq } from 'drizzle-orm';
import { getCustomer, getStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { loadFile } from '@/lib/upload';

// Payment proofs are private: only the customer who uploaded one, or staff who manage payments, can open it.
export async function GET(_: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!/^[a-f0-9]{24}\.(png|jpg|webp)$/.test(file)) return new Response('Not found', { status: 404 });
  const db = await getDb();
  const [p] = await db.select().from(s.payments).where(eq(s.payments.proofFile, file));
  if (!p) return new Response('Not found', { status: 404 });
  const staff = await getStaff();
  let ok = !!staff && !staff.mustChangePassword && staff.perms.has('payments.manage');
  if (!ok) { const c = await getCustomer(); ok = !!c && c.id === p.customerId; }
  if (!ok) return new Response('Forbidden', { status: 403 });
  const f = await loadFile(file, true);
  if (!f) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(f.buf), { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
}
