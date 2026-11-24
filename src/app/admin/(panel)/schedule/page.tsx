import { asc, eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings } from '@/lib/availability';
import { addDays, fmtDate, isDateStr, todayIn } from '@/lib/time';
import { loadRange, net } from '@/lib/report';
import { addTimeOffAction, deleteTimeOffAction } from '@/app/actions/admin';
import { ActionForm, Field, Submit } from '@/components/forms';

const DN: [string, string, string][] = [['sat', 'السبت', 'Sat'], ['sun', 'الأحد', 'Sun'], ['mon', 'الاثنين', 'Mon'], ['tue', 'الثلاثاء', 'Tue'], ['wed', 'الأربعاء', 'Wed'], ['thu', 'الخميس', 'Thu'], ['fri', 'الجمعة', 'Fri']];

export default async function Schedule({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaff('staff.manage'); const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en); const cfg = bookingSettings(settings);
  const q = await searchParams, db = await getDb(), today = todayIn(cfg.tz);
  const from = q.from && isDateStr(q.from) ? q.from : addDays(today, -29), to = q.to && isDateStr(q.to) ? q.to : today;
  const staff = await db.select().from(s.staff).where(eq(s.staff.active, true)).orderBy(asc(s.staff.id));
  const off = await db.select().from(s.staffTimeOff).orderBy(asc(s.staffTimeOff.startsAt));
  const { bookings, pays } = await loadRange(db, from, addDays(to, 1), cfg.tz);
  const bk = new Map<number, any>(); for (const b of bookings) bk.set(b.id, b);
  const sn = (x: any) => (lang === 'ar' ? x.nameAr : x.nameEn);
  const perf = staff.map((st: any) => {
    const mine = bookings.filter((b: any) => b.staffId === st.id), done = mine.filter((b: any) => b.status === 'completed');
    const revenue = pays.filter((p: any) => bk.get(p.bookingId)?.staffId === st.id).reduce((a: number, p: any) => a + net(p), 0);
    const booked = mine.filter((b: any) => b.status !== 'cancelled').length;
    return { st, booked, done: done.length, cancelled: mine.filter((b: any) => b.status === 'cancelled').length, value: done.reduce((a: number, b: any) => a + b.price, 0), revenue };
  });
  const future = off.filter((o: any) => +new Date(o.endsAt) > Date.now());
  return (
    <>
      <h1>{m('جداول الموظفات والأداء', 'Staff schedules & performance')}</h1>
      <h2>{m('ساعات العمل الأسبوعية', 'Weekly working hours')}</h2>
      <p className="muted">{m('تُعدَّل من صفحة الموظفين والصلاحيات.', 'Edit them from Staff & roles.')} <a href="/admin/staff">{m('فتح', 'Open')}</a></p>
      <table><thead><tr><th></th>{DN.map(d => <th key={d[0]}>{m(d[1], d[2])}</th>)}</tr></thead><tbody>
        {staff.map((st: any) => <tr key={st.id}><td><b>{sn(st)}</b></td>{DN.map(d => { const w = st.workingHours?.[d[0]]; return <td key={d[0]}>{w ? `${w.from}-${w.to}` : <span className="muted">{m('إجازة', 'Off')}</span>}</td>; })}</tr>)}</tbody></table>

      <h2 style={{ marginTop: 26 }}>{m('الإجازات', 'Time off')}</h2>
      <div className="card wide"><ActionForm action={addTimeOffAction}>
        <div className="grid3"><div><label>{m('الموظفة', 'Staff')}</label><select name="staffId">{staff.map((st: any) => <option key={st.id} value={st.id}>{sn(st)}</option>)}</select></div>
          <Field label={m('من', 'From')} name="from" type="date" min={today} required /><Field label={m('إلى (اختياري)', 'To (optional)')} name="to" type="date" min={today} /></div>
        <Field label={m('السبب (اختياري)', 'Reason (optional)')} name="reason" /><Submit>{m('تسجيل إجازة', 'Add time off')}</Submit></ActionForm></div>
      {future.length > 0 && <table style={{ marginTop: 12 }}><tbody>{future.map((o: any) => (
        <tr key={o.id}><td>{sn(staff.find((x: any) => x.id === o.staffId) ?? {})}</td><td>{fmtDate(o.startsAt, lang, cfg.tz)} {'->'} {fmtDate(new Date(+new Date(o.endsAt) - 1), lang, cfg.tz)}</td><td>{o.reason}</td>
          <td><form action={deleteTimeOffAction}><input type="hidden" name="id" value={o.id} /><button className="btn sm danger">{m('حذف', 'Delete')}</button></form></td></tr>))}</tbody></table>}

      <h2 style={{ marginTop: 26 }}>{m('الأداء', 'Performance')}</h2>
      <form className="filters" method="get"><div><label>{m('من', 'From')}</label><input type="date" name="from" defaultValue={from} /></div><div><label>{m('إلى', 'To')}</label><input type="date" name="to" defaultValue={to} /></div><button className="btn">{m('عرض', 'Show')}</button></form>
      <table><thead><tr><th>{m('الموظفة', 'Staff')}</th><th>{m('حجوزات', 'Booked')}</th><th>{m('مكتملة', 'Completed')}</th><th>{m('ملغاة', 'Cancelled')}</th><th>{m('قيمة الجلسات المكتملة', 'Completed value')}</th><th>{m('الإيراد المحصّل', 'Collected')}</th></tr></thead><tbody>
        {perf.map((p: any) => <tr key={p.st.id}><td>{sn(p.st)}</td><td>{p.booked}</td><td>{p.done}</td><td>{p.cancelled}</td><td>{p.value} {m('ج.م', 'EGP')}</td><td>{p.revenue} {m('ج.م', 'EGP')}</td></tr>)}</tbody></table>
      <p className="muted">{m('الإيراد المحصّل = المدفوعات المعتمدة في الفترة (عربون + باقي − استرداد) للحجوزات التي بدأت في نفس الفترة.', 'Collected = approved payments in the period (deposit + balance − refunds) for bookings starting in the period.')}</p>
    </>
  );
}
