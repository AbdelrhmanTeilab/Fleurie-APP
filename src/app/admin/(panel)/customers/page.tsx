import { desc, eq, ilike, or } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireStaff('customers.view'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const q = ((await searchParams).q ?? '').trim().slice(0, 80), db = await getDb();
  const like = `%${q.replace(/[%_\\]/g, '\\$&')}%`;
  const rows = await db.select().from(s.customers).where(q ? or(ilike(s.customers.name, like), ilike(s.customers.whatsapp, like), ilike(s.customers.email, like)) : undefined).orderBy(desc(s.customers.createdAt)).limit(200);
  const bks = rows.length ? await db.select().from(s.bookings) : [], pays = rows.length ? await db.select().from(s.payments).where(eq(s.payments.status, 'approved')) : [];
  const stats = (id: number) => { const mine = bks.filter((b: any) => b.customerId === id && b.status === 'completed'); return { n: mine.length, spent: pays.filter((p: any) => p.customerId === id).reduce((a: number, p: any) => a + (p.kind === 'refund' ? -p.amount : p.amount), 0), last: mine.map((b: any) => +new Date(b.startsAt)).sort().at(-1) }; };
  const st: Record<string, [string, string]> = { active: ['ok', m('مفعّل', 'Active')], pending: ['warn', m('بانتظار التحقق', 'Pending')], blocked: ['bad', m('موقوف', 'Blocked')] };
  return (
    <>
      <h1>{m('العملاء', 'Customers')}</h1>
      <form style={{ margin: '12px 0 18px', display: 'flex', gap: 8, maxWidth: 480 }}>
        <input type="text" name="q" defaultValue={q} placeholder={m('بحث بالاسم أو الرقم أو البريد', 'Search name, number or email')} />
        <button className="btn sm">{m('بحث', 'Search')}</button>
      </form>
      <table><thead><tr><th>{m('الاسم', 'Name')}</th><th>{m('واتساب', 'WhatsApp')}</th><th>{m('البريد', 'Email')}</th><th>{m('الحالة', 'Status')}</th><th>{m('جلسات', 'Visits')}</th><th>{m('إجمالي المدفوع', 'Total paid')}</th><th>{m('آخر زيارة', 'Last visit')}</th><th>{m('التسجيل', 'Registered')}</th></tr></thead>
        <tbody>{rows.length ? rows.map((c: any) => (
          <tr key={c.id}><td><a href={`/admin/customers/${c.id}`}>{c.name}</a></td><td dir="ltr">{c.whatsapp}</td><td dir="ltr">{c.email}</td>
            <td><span className={`tag ${st[c.status][0]}`}>{st[c.status][1]}</span></td><td>{stats(c.id).n}</td><td>{stats(c.id).spent} {m('ج.م', 'EGP')}</td><td>{stats(c.id).last ? new Date(stats(c.id).last!).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB') : '-'}</td><td>{new Date(c.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</td></tr>
        )) : <tr><td colSpan={8} className="muted">{m('لا يوجد عملاء', 'No customers yet')}</td></tr>}</tbody></table>
    </>
  );
}
