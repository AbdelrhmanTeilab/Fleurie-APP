import { requireStaff } from '@/lib/auth';
import { getDb } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings } from '@/lib/availability';
import { isDateStr, todayIn } from '@/lib/time';
import { loadFinance } from '@/lib/finance';
import { net } from '@/lib/report';

const cell = (v: unknown) => { let t = String(v ?? ''); if (typeof v === 'string' && /^[=+\-@]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
export async function GET(req: Request) {
  await requireStaff('finance.view');
  const { settings } = await getI18n(); const cfg = bookingSettings(settings), url = new URL(req.url), today = todayIn(cfg.tz);
  const f = url.searchParams.get('from'), t = url.searchParams.get('to');
  const from = isDateStr(f) ? f : today.slice(0, 8) + '01', to = isDateStr(t) && t >= from ? t : today;
  const F = await loadFinance(await getDb(), from, to, cfg.tz);
  const rows: unknown[][] = [['type', 'date', 'category_or_kind', 'description', 'amount']];
  for (const x of F.pays) rows.push(['income', F.dayOf(x.p.reviewedAt, cfg.tz), x.p.kind, x.b.serviceNameEn, net(x.p)]);
  for (const e of F.expenses) rows.push(['expense', e.date, e.category, e.note, -e.amount]);
  rows.push([], ['total_revenue', '', '', '', F.revenue], ['total_expenses', '', '', '', -F.spent], ['net_profit', '', '', '', F.profit]);
  return new Response('\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n'), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="fleurie-finance-${from}_${to}.csv"`, 'cache-control': 'no-store' } });
}
