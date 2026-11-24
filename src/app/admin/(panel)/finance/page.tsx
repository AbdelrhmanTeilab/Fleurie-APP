import { eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings } from '@/lib/availability';
import { addDays, isDateStr, todayIn } from '@/lib/time';
import { loadFinance } from '@/lib/finance';
import { addExpenseAction, deleteExpenseAction } from '@/app/actions/ops';
import { EXPENSE_CATS } from '@/lib/expenseCats';
import { ActionForm, Field, Submit } from '@/components/forms';

export default async function Finance({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  await requireStaff('finance.view'); const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const cfg = bookingSettings(settings), q = await searchParams, db = await getDb(), cur = m('ج.م', 'EGP'), today = todayIn(cfg.tz);
  const from = isDateStr(q.from) ? q.from : today.slice(0, 8) + '01';
  const to = isDateStr(q.to) && q.to >= from ? q.to : today;
  const F = await loadFinance(db, from, to, cfg.tz);
  const sups = await db.select().from(s.suppliers), purchases = await db.select().from(s.purchases), spay = (await db.select().from(s.expenses).where(eq(s.expenses.category, 'supplier_payment')));
  const payable = purchases.reduce((a: number, p: any) => a + p.total, 0) - spay.reduce((a: number, p: any) => a + p.amount, 0);
  const catName: Record<string, string> = { rent: m('إيجار', 'Rent'), salaries: m('مرتبات', 'Salaries'), utilities: m('مرافق', 'Utilities'), marketing: m('تسويق', 'Marketing'), supplies: m('مستلزمات', 'Supplies'), other: m('أخرى', 'Other'), supplier_payment: m('دفعات موردين', 'Supplier payments') };
  const sn = (id: number | null) => sups.find((x: any) => x.id === id)?.name ?? '';
  const outTotal = F.outstanding.reduce((a: number, x: any) => a + x.due, 0);
  const monthStart = today.slice(0, 8) + '01';
  return (
    <>
      <h1>{m('الحسابات', 'Finance')}</h1>
      <form className="filters" method="get">
        <label style={{ margin: 0 }}>{m('من', 'From')}</label><input type="date" name="from" defaultValue={from} />
        <label style={{ margin: 0 }}>{m('إلى', 'To')}</label><input type="date" name="to" defaultValue={to} />
        <button className="btn sm">{m('عرض', 'Apply')}</button>
        <a className="pill" href={`/admin/finance?from=${monthStart}&to=${today}`}>{m('هذا الشهر', 'This month')}</a>
        <a className="pill" href={`/admin/finance?from=${addDays(today, -29)}&to=${today}`}>{m('آخر 30 يوم', 'Last 30 days')}</a>
        <a className="btn sm ghost" href={`/admin/finance/export?from=${from}&to=${to}`}>{m('تصدير CSV', 'Export CSV')}</a>
      </form>
      <div className="stats">
        <div className="stat">{m('الإيراد المحصّل', 'Revenue collected')}<b>{F.revenue}</b><span className="muted">{cur}</span></div>
        <div className="stat">{m('المصروفات', 'Expenses')}<b>{F.spent}</b><span className="muted">{cur}</span></div>
        <div className="stat">{m('صافي الربح', 'Net profit')}<b style={{ color: F.profit < 0 ? 'var(--bad, #b3261e)' : undefined }}>{F.profit}</b><span className="muted">{cur}</span></div>
        <div className="stat">{m('مبالغ متبقية عند العملاء', 'Owed by customers')}<b>{outTotal}</b><span className="muted">{cur}</span></div>
        <div className="stat">{m('مستحق للموردين', 'Owed to suppliers')}<b>{payable}</b><span className="muted">{cur}</span></div>
        <div className="stat">{m('تكلفة المنتجات المستهلكة', 'Product cost used')}<b>{F.consumed}</b><span className="muted">{cur}</span></div>
      </div>
      <p className="muted">{m('الربح على أساس النقدية: ما حُصّل فعلًا (عربون وباقي بعد الموافقة، ناقص المرتجعات) مطروحًا منه ما صُرف فعلًا. تكلفة المنتجات المستهلكة للمعلومية فقط ولا تُخصم مرة ثانية لأنها دُفعت ضمن المشتريات.', 'Cash basis: money actually collected (approved deposits and balances, minus refunds) minus money actually spent. Product cost used is shown for information only and is not deducted again because it is paid through purchases.')}</p>

      <div className="grid2" style={{ gap: 16 }}>
        <div className="card wide"><h3>{m('الإيراد حسب الجلسة', 'Revenue by session')}</h3>
          <table><tbody>{[...F.bySvc.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => { const [en, ar] = k.split('|'); return <tr key={k}><td>{lang === 'ar' ? ar : en}</td><td>{v} {cur}</td></tr>; })}{!F.bySvc.size && <tr><td className="muted">—</td></tr>}</tbody></table></div>
        <div className="card wide"><h3>{m('المصروفات حسب التصنيف', 'Expenses by category')}</h3>
          <table><tbody>{[...F.byCat.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => <tr key={k}><td>{catName[k] ?? k}</td><td>{v} {cur}</td></tr>)}{!F.byCat.size && <tr><td className="muted">—</td></tr>}</tbody></table></div>
      </div>

      <h2 style={{ marginTop: 26 }}>{m('تسجيل مصروف', 'Add an expense')}</h2>
      <div className="card wide"><ActionForm action={addExpenseAction}>
        <div className="grid3">
          <Field label={m('التاريخ', 'Date')} name="date" type="date" defaultValue={today} required />
          <div><label>{m('التصنيف', 'Category')}</label><select name="category">{EXPENSE_CATS.map(c => <option key={c} value={c}>{catName[c]}</option>)}</select></div>
          <Field label={m('المبلغ (ج.م)', 'Amount (EGP)')} name="amount" type="number" min={1} required />
        </div>
        <div className="grid2"><div><label>{m('طريقة الدفع', 'Method')}</label><select name="method"><option value="cash">{m('نقدًا', 'Cash')}</option><option value="transfer">{m('تحويل', 'Transfer')}</option></select></div><Field label={m('ملاحظة', 'Note')} name="note" /></div>
        <Submit>{m('حفظ', 'Save')}</Submit>
      </ActionForm></div>

      <h2 style={{ marginTop: 26 }}>{m('المصروفات في الفترة', 'Expenses in period')}</h2>
      <table><tbody>{F.expenses.map((e: any) => (
        <tr key={e.id}><td>{e.date}</td><td>{catName[e.category] ?? e.category}{e.supplierId ? ` · ${sn(e.supplierId)}` : ''}</td><td>{e.amount} {cur}</td><td className="muted">{e.note}</td>
          <td>{e.category !== 'supplier_payment' && <form action={deleteExpenseAction}><input type="hidden" name="id" value={e.id} /><button className="btn sm danger">{m('حذف', 'Delete')}</button></form>}</td></tr>))}
        {!F.expenses.length && <tr><td className="muted">—</td></tr>}</tbody></table>

      <h2 style={{ marginTop: 26 }}>{m('مبالغ متبقية على العملاء', 'Customer balances due')}</h2>
      <table><tbody>{F.outstanding.map((x: any) => (
        <tr key={x.b.id}><td>{x.c}</td><td>{lang === 'ar' ? x.b.serviceNameAr : x.b.serviceNameEn}</td><td><b>{x.due}</b> {cur}</td><td><a href={`/admin/bookings/${x.b.id}`}>{m('فتح', 'Open')}</a></td></tr>))}
        {!F.outstanding.length && <tr><td className="muted">—</td></tr>}</tbody></table>
    </>
  );
}
