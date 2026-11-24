import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/db';
import { getSettings } from '@/lib/i18n';
import { runReminders } from '@/lib/reminders';
import { expireHolds } from '@/lib/availability';

export const dynamic = 'force-dynamic';
// Call hourly from any scheduler: curl -H "Authorization: Bearer $CRON_SECRET" https://your-site/api/cron/reminders
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET; if (!secret || secret.length < 16) return Response.json({ error: 'CRON_SECRET not configured (min 16 chars)' }, { status: 503 });
  const got = Buffer.from((req.headers.get('authorization') ?? '').replace(/^Bearer /, '')), want = Buffer.from(secret);
  if (got.length !== want.length || !timingSafeEqual(got, want)) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const db = await getDb(); await expireHolds(db);
  return Response.json({ ok: true, ...(await runReminders(db, await getSettings())) });
}
export const GET = handle, POST = handle;
