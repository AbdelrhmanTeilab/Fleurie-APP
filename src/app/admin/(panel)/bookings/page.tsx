import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { can, requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds } from '@/lib/availability';
import { addDays, fmtDateTime, isDateStr, zonedToUtc } from '@/lib/time';
import { tagClass } from '@/lib/status';

const STATUSES = ['pending_deposit', 'pending_confirmation', 'confirmed', 'completed', 'cancelled'];
const SL: Record<string, [string, string]> = { pending_deposit: ['بانتظار العربون', 'Awaiting deposit'], pending_confirmation: ['بانتظار المراجعة', 'To review'], confirmed: ['مؤكد', 'Confirmed'], completed: ['مكتمل', 'Completed'], cancelled: ['ملغي', 'Cancelled'] };

export default async function Bookings({ searchParams }: { searchParams: Promise<{ status?: string; date?: string }> }) {
  const u = await requireStaff(); if (!can(u, 'bookings.all') && !can(u, 'bookings.own')) await requireStaff('bookings.all');
  const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en); const cfg = bookingSettings(settings);
  const q = await searchParams, db = await getDb(); await expireHolds(db);
  const conds: any[] = [];
  if (!can(u, 'bookings.all')) conds.push(eq(s.bookings.staffId, u.id));
  if (q.status && STATUSES.includes(q.status)) conds.push(eq(s.bookings.status, q.status));
  if (q.date && isDateStr(q.date)) conds.push(gte(s.bookings.startsAt, zonedToUtc(q.date, 0, cfg.tz)), lt(s.bookings.startsAt, zonedToUtc(addDays(q.date, 1), 0, cfg.tz)));
  const rows = await db.select({ b: s.bookings, c: s.customers.name, wa: s.customers.whatsapp, st: s.staff.nameAr, stEn: s.staff.nameEn }).from(s.bookings)
    .innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId)).innerJoin(s.staff, eq(s.staff.id, s.bookings.staffId))
    .where(conds.length ? and(...conds) : undefined).orderBy(desc(s.bookings.startsAt)).limit(300);
  const canPhone = can(u, 'customers.view');
  return (
    <>
      <h1>{can(u, 'bookings.all') ? m('الحجوزات', 'Bookings') : m('حجوزاتي', 'My bookings')}</h1>
      <form className="filters" method="get">
        <div><label>{m('الحالة', 'Status')}</label><select name="status" defaultValue={q.status ?? ''}><option value="">{m('الكل', 'All')}</option>{STATUSES.map(x => <option key={x} value={x}>{m(...SL[x])}</option>)}</select></div>
        <div><label>{m('اليوم', 'Day')}</label><input type="date" name="date" defaultValue={q.date ?? ''} /></div>
        <button className="btn">{m('تصفية', 'Filter')}</button>
      </form>
      <table><thead><tr><th>{m('الموعد', 'When')}</th><th>{m('العميلة', 'Customer')}</th><th>{m('الجلسة', 'Session')}</th><th>{m('الأخصائية', 'Specialist')}</th><th>{m('الحالة', 'Status')}</th><th></th></tr></thead>
        <tbody>{rows.map(({ b, c, wa, st, stEn }: any) => (
          <tr key={b.id}><td>{fmtDateTime(b.startsAt, lang, cfg.tz)}</td><td>{c}{canPhone && <div className="muted" dir="ltr">{wa}</div>}</td><td>{lang === 'ar' ? b.serviceNameAr : b.serviceNameEn}<div className="muted">{b.price} {m('ج.م', 'EGP')}</div></td>
            <td>{lang === 'ar' ? st : stEn}</td><td><span className={`tag ${tagClass(b.status)}`}>{m(...SL[b.status])}</span></td><td><a href={`/admin/bookings/${b.id}`}>{m('فتح', 'Open')}</a></td></tr>))}
          {!rows.length && <tr><td colSpan={6} className="muted">{m('لا توجد حجوزات', 'No bookings')}</td></tr>}</tbody></table>
    </>
  );
}
