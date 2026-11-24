import { count, eq } from 'drizzle-orm';
import { can, requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds } from '@/lib/availability';
import { addDays, fmtTime, todayIn } from '@/lib/time';
import { dayOf, daysBetween, loadRange, net } from '@/lib/report';
import { Bars } from '@/components/Bars';

export default async function Overview({ searchParams }: { searchParams: Promise<{ denied?: string; r?: string }> }) {
  const u = await requireStaff(); const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const cfg = bookingSettings(settings), q = await searchParams, db = await getDb(); await expireHolds(db);
  const R = [7, 30, 90].includes(Number(q.r)) ? Number(q.r) : 30;
  const today = todayIn(cfg.tz), from = addDays(today, -(R - 1)), cur = m('ج.م', 'EGP');
  const all = can(u, 'bookings.all'), fin = can(u, 'finance.view');
  const n = async (t: any, where?: any) => (await db.select({ c: count() }).from(t).where(where))[0].c;

  const todayRows = await db.select({ b: s.bookings, c: s.customers.name }).from(s.bookings).innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId))
    .where(eq(s.bookings.status, 'confirmed'));
  const mine = todayRows.filter((x: any) => dayOf(x.b.startsAt, cfg.tz) === today && (all || x.b.staffId === u.id)).sort((a: any, b: any) => +a.b.startsAt - +b.b.startsAt);

  const { bookings, pays } = await loadRange(db, from, addDays(today, 1), cfg.tz);
  const live = bookings.filter((b: any) => b.status !== 'cancelled');
  const days = daysBetween(from, R);
  const byDay = days.map(d => ({ label: d.slice(5), value: live.filter((b: any) => dayOf(b.startsAt, cfg.tz) === d).length }));
  const revByDay = days.map(d => ({ label: d.slice(5), value: pays.filter((p: any) => dayOf(p.reviewedAt, cfg.tz) === d).reduce((a: number, p: any) => a + net(p), 0) }));
  const revenue = revByDay.reduce((a, d) => a + d.value, 0);
  const done = bookings.filter((b: any) => b.status === 'completed'), cancelled = bookings.filter((b: any) => b.status === 'cancelled');
  const top = new Map<string, number>(); for (const b of live) { const k = lang === 'ar' ? b.serviceNameAr : b.serviceNameEn; top.set(k, (top.get(k) ?? 0) + 1); }
  const topList = [...top.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const [toReview, newCust, totalCust, manual] = await Promise.all([n(s.payments, eq(s.payments.status, 'submitted')), n(s.customers, eq(s.customers.status, 'pending')), n(s.customers, eq(s.customers.status, 'active')), n(s.notifications, eq(s.notifications.status, 'manual'))]);
  const lowStock = can(u, 'inventory.manage') ? (await db.select().from(s.products).where(eq(s.products.active, true))).filter((p: any) => p.stock <= p.reorderLevel) : [];
  return (
    <>
      <h1>{m('مرحبًا', 'Welcome')}، {lang === 'ar' ? u.nameAr : u.nameEn}</h1>
      {lowStock.length > 0 && <div className="msg err">{m('مخزون ناقص: ', 'Low stock: ')}{lowStock.map((p: any) => (lang === 'ar' ? p.nameAr : p.nameEn)).join('، ')} · <a href="/admin/inventory">{m('فتح المخزون', 'Open inventory')}</a></div>}
      {q.denied && <div className="msg err">{m('ليست لديك صلاحية لهذه الصفحة', 'You do not have access to that page')}</div>}

      <h2 style={{ marginTop: 18 }}>{all ? m('مواعيد اليوم', "Today's appointments") : m('مواعيدي اليوم', 'My appointments today')}</h2>
      <table><tbody>{mine.length ? mine.map((x: any) => (
        <tr key={x.b.id}><td style={{ width: 90 }}><b>{fmtTime(x.b.startsAt, lang, cfg.tz)}</b></td><td>{x.c}</td><td>{lang === 'ar' ? x.b.serviceNameAr : x.b.serviceNameEn}</td><td><a href={`/admin/bookings/${x.b.id}`}>{m('فتح', 'Open')}</a></td></tr>))
        : <tr><td className="muted">{m('لا توجد مواعيد مؤكدة اليوم', 'No confirmed appointments today')}</td></tr>}</tbody></table>

      {all && <>
        <div className="filters" style={{ marginTop: 26 }}><h2 style={{ margin: 0 }}>{m('الأداء', 'Performance')}</h2>
          {[7, 30, 90].map(r => <a key={r} className={`pill${r === R ? ' on' : ''}`} href={`/admin?r=${r}`}>{m(`${r} يوم`, `${r} days`)}</a>)}</div>
        <div className="stats">
          <div className="stat">{m('حجوزات الفترة', 'Bookings')}<b>{live.length}</b></div>
          <div className="stat">{m('جلسات مكتملة', 'Completed')}<b>{done.length}</b></div>
          <div className="stat">{m('ملغاة', 'Cancelled')}<b>{cancelled.length}</b></div>
          {fin && <div className="stat">{m('الإيراد المحصّل', 'Revenue collected')}<b>{revenue}</b><span className="muted">{cur}</span></div>}
          {fin && <div className="stat">{m('متوسط الجلسة', 'Avg. session value')}<b>{done.length ? Math.round(done.reduce((a: number, b: any) => a + b.price, 0) / done.length) : 0}</b><span className="muted">{cur}</span></div>}
          <div className="stat">{m('عربون بانتظار المراجعة', 'Deposits to review')}<b>{toReview}</b><a href="/admin/bookings?status=pending_confirmation">{m('مراجعة', 'Review')}</a></div>
        </div>
        <div className="grid2" style={{ gap: 16 }}>
          <div className="card wide"><h3>{m('الحجوزات يوميًا', 'Bookings per day')}</h3><Bars data={byDay} /></div>
          {fin && <div className="card wide"><h3>{m('الإيراد يوميًا', 'Revenue per day')} ({cur})</h3><Bars data={revByDay} unit={` ${cur}`} /></div>}
        </div>
        <div className="grid2" style={{ gap: 16, marginTop: 16 }}>
          <div className="card wide"><h3>{m('الأكثر طلبًا', 'Most booked sessions')}</h3>
            {topList.length ? <table><tbody>{topList.map(([k, v]) => <tr key={k}><td>{k}</td><td style={{ width: 60 }}><b>{v}</b></td></tr>)}</tbody></table> : <p className="muted">{m('لا بيانات بعد', 'No data yet')}</p>}</div>
          <div className="stats" style={{ margin: 0 }}>
            <div className="stat">{m('عميلات مفعّلة', 'Verified customers')}<b>{totalCust}</b></div>
            <div className="stat">{m('بانتظار التحقق', 'Awaiting verification')}<b>{newCust}</b></div>
            <div className="stat">{m('رسائل للإرسال اليدوي', 'Messages to send manually')}<b>{manual}</b></div>
          </div>
        </div>
        {!fin && <p className="muted">{m('الأرقام المالية تظهر لمن لديه صلاحية الحسابات.', 'Financial figures are shown only to staff with finance access.')}</p>}
      </>}
    </>
  );
}
