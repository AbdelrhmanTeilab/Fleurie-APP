import { and, eq, gt, inArray, lt } from 'drizzle-orm';
import { can, requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds } from '@/lib/availability';
import { addDays, dayKey, fmtTime, isDateStr, todayIn, zonedToUtc } from '@/lib/time';
import { dayOf } from '@/lib/report';

const DN: Record<string, [string, string]> = { sat: ['السبت', 'Sat'], sun: ['الأحد', 'Sun'], mon: ['الاثنين', 'Mon'], tue: ['الثلاثاء', 'Tue'], wed: ['الأربعاء', 'Wed'], thu: ['الخميس', 'Thu'], fri: ['الجمعة', 'Fri'] };

export default async function Calendar({ searchParams }: { searchParams: Promise<{ d?: string; staff?: string }> }) {
  const u = await requireStaff(); if (!can(u, 'bookings.all') && !can(u, 'bookings.own')) await requireStaff('bookings.all');
  const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en); const cfg = bookingSettings(settings);
  const q = await searchParams, db = await getDb(); await expireHolds(db);
  const all = can(u, 'bookings.all'), today = todayIn(cfg.tz);
  let start = q.d && isDateStr(q.d) ? q.d : today;
  const order = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
  start = addDays(start, -order.indexOf(dayKey(start)));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const a = zonedToUtc(start, 0, cfg.tz), b = zonedToUtc(addDays(start, 7), 0, cfg.tz);
  const staffList = await db.select().from(s.staff).where(eq(s.staff.active, true));
  const filter = all ? Number(q.staff) || 0 : u.id;
  const rows = await db.select({ b: s.bookings, c: s.customers.name }).from(s.bookings).innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(and(gt(s.bookings.endsAt, a), lt(s.bookings.startsAt, b), inArray(s.bookings.status, ['pending_deposit', 'pending_confirmation', 'confirmed', 'completed']), filter ? eq(s.bookings.staffId, filter) : undefined));
  const off = await db.select().from(s.staffTimeOff).where(and(gt(s.staffTimeOff.endsAt, a), lt(s.staffTimeOff.startsAt, b), filter ? eq(s.staffTimeOff.staffId, filter) : undefined));
  const sn = (id: number) => { const x = staffList.find((y: any) => y.id === id); return x ? (lang === 'ar' ? x.nameAr : x.nameEn) : ''; };
  const col: Record<string, string> = { pending_deposit: 'warn', pending_confirmation: 'warn', confirmed: 'ok', completed: '' };
  const link = (d: string) => `/admin/calendar?d=${d}${filter && all ? `&staff=${filter}` : ''}`;
  return (
    <>
      <h1>{m('تقويم الحجوزات', 'Booking calendar')}</h1>
      <div className="filters">
        <a className="btn sm ghost" href={link(addDays(start, -7))}>{m('الأسبوع السابق', 'Previous week')}</a>
        <a className="btn sm ghost" href={link(today)}>{m('هذا الأسبوع', 'This week')}</a>
        <a className="btn sm ghost" href={link(addDays(start, 7))}>{m('الأسبوع التالي', 'Next week')}</a>
        {all && <form method="get" style={{ display: 'flex', gap: 8 }}><input type="hidden" name="d" value={start} />
          <select name="staff" defaultValue={filter || ''}><option value="">{m('كل الأخصائيات', 'All specialists')}</option>{staffList.map((x: any) => <option key={x.id} value={x.id}>{sn(x.id)}</option>)}</select><button className="btn sm">{m('تصفية', 'Filter')}</button></form>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(130px,1fr))', gap: 8, overflowX: 'auto' }}>
        {days.map(d => {
          const items = rows.filter((x: any) => dayOf(x.b.startsAt, cfg.tz) === d).sort((x: any, y: any) => +x.b.startsAt - +y.b.startsAt);
          const offs = off.filter((x: any) => dayOf(x.startsAt, cfg.tz) <= d && dayOf(new Date(+new Date(x.endsAt) - 1), cfg.tz) >= d);
          return (
            <div key={d} className="card" style={{ padding: 10, maxWidth: 'none', background: d === today ? 'var(--accent-soft)' : undefined }}>
              <b>{m(...DN[dayKey(d)])}</b> <span className="muted">{d.slice(5)}</span>
              {offs.map((x: any) => <div key={x.id} className="tag bad" style={{ display: 'block', margin: '6px 0' }}>{sn(x.staffId)}: {m('إجازة', 'Off')}</div>)}
              {items.map((x: any) => (
                <a key={x.b.id} href={`/admin/bookings/${x.b.id}`} style={{ display: 'block', textDecoration: 'none', color: 'inherit', margin: '6px 0', padding: '6px 8px', borderRadius: 10, border: '1px solid var(--line)', background: 'var(--surface)', fontSize: '.82rem' }}>
                  <b>{fmtTime(x.b.startsAt, lang, cfg.tz)}</b> <span className={`tag ${col[x.b.status]}`}>{x.b.status === 'confirmed' ? m('مؤكد', 'OK') : x.b.status === 'completed' ? m('تم', 'Done') : m('معلّق', 'Pending')}</span>
                  <div>{x.c}</div><div className="muted">{lang === 'ar' ? x.b.serviceNameAr : x.b.serviceNameEn}{all && !filter ? ` · ${sn(x.b.staffId)}` : ''}</div></a>))}
              {!items.length && !offs.length && <div className="muted" style={{ marginTop: 6 }}>-</div>}
            </div>);
        })}
      </div>
    </>
  );
}
