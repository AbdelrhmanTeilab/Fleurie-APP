import { and, asc, desc, eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings } from '@/lib/availability';
import { todayIn } from '@/lib/time';
import { addPurchaseAction, paySupplierAction, saveSupplierAction } from '@/app/actions/ops';
import { ActionForm, Field, Submit } from '@/components/forms';

type M = (a: string, e: string) => string;
function SupplierForm({ x, m }: { x?: any; m: M }) {
  return (
    <ActionForm action={saveSupplierAction}>
      {x && <input type="hidden" name="id" value={x.id} />}
      <div className="grid3">
        <Field label={m('اسم المورد', 'Supplier name')} name="name" defaultValue={x?.name} required />
        <Field label={m('الهاتف', 'Phone')} name="phone" defaultValue={x?.phone} dir="ltr" />
        <Field label={m('البريد', 'Email')} name="email" defaultValue={x?.email} dir="ltr" />
      </div>
      <div><label>{m('ملاحظات', 'Notes')}</label><textarea name="notes" rows={2} defaultValue={x?.notes} /></div>
      <div className="check"><input type="checkbox" id={`sa${x?.id ?? 'n'}`} name="active" defaultChecked={x ? x.active : true} /><label style={{ margin: 0 }} htmlFor={`sa${x?.id ?? 'n'}`}>{m('نشط', 'Active')}</label></div>
      <Submit>{m('حفظ', 'Save')}</Submit>
    </ActionForm>
  );
}

export default async function Suppliers() {
  await requireStaff('suppliers.manage'); const { lang, settings } = await getI18n(); const m: M = (ar, en) => (lang === 'ar' ? ar : en);
  const cfg = bookingSettings(settings), db = await getDb(), cur = m('ج.م', 'EGP'), today = todayIn(cfg.tz);
  const sups = await db.select().from(s.suppliers).orderBy(asc(s.suppliers.name));
  const prods = await db.select().from(s.products).where(eq(s.products.active, true)).orderBy(asc(s.products.nameEn));
  const purchases = await db.select().from(s.purchases).orderBy(desc(s.purchases.date), desc(s.purchases.id)).limit(40);
  const allPurchases = await db.select().from(s.purchases);
  const pays = await db.select().from(s.expenses).where(eq(s.expenses.category, 'supplier_payment'));
  const owed = (id: number) => allPurchases.filter((p: any) => p.supplierId === id).reduce((a: number, p: any) => a + p.total, 0) - pays.filter((p: any) => p.supplierId === id).reduce((a: number, p: any) => a + p.amount, 0);
  const active = sups.filter((x: any) => x.active);
  const sn = (id: number) => sups.find((x: any) => x.id === id)?.name ?? '#' + id;
  const totalOwed = sups.reduce((a: number, x: any) => a + Math.max(0, owed(x.id)), 0);
  const pOpts = prods.map((p: any) => <option key={p.id} value={p.id}>{lang === 'ar' ? p.nameAr : p.nameEn}</option>);
  return (
    <>
      <h1>{m('الموردون والمشتريات', 'Suppliers & purchases')}</h1>
      <div className="stats"><div className="stat">{m('إجمالي المستحق للموردين', 'Total owed to suppliers')}<b>{totalOwed}</b><span className="muted">{cur}</span></div></div>

      <details className="box" open={!sups.length}><summary>+ {m('إضافة مورد', 'Add a supplier')}</summary><SupplierForm m={m} /></details>
      <table>
        <thead><tr><th>{m('المورد', 'Supplier')}</th><th>{m('الهاتف', 'Phone')}</th><th>{m('المستحق', 'Owed')}</th></tr></thead>
        <tbody>{sups.map((x: any) => <tr key={x.id}><td>{x.name} {!x.active && <span className="tag bad">{m('موقوف', 'Inactive')}</span>}</td><td dir="ltr">{x.phone}</td><td>{owed(x.id) > 0 ? <span className="tag warn">{owed(x.id)} {cur}</span> : <span className="muted">0</span>}</td></tr>)}
          {!sups.length && <tr><td className="muted">{m('لا يوجد موردون بعد', 'No suppliers yet')}</td></tr>}</tbody>
      </table>
      {sups.map((x: any) => <details className="box" key={x.id}><summary>{m('تعديل: ', 'Edit: ')}{x.name}</summary><SupplierForm x={x} m={m} /></details>)}

      {active.length > 0 && prods.length > 0 && <>
        <h2 style={{ marginTop: 26 }}>{m('تسجيل فاتورة شراء', 'Record a purchase invoice')}</h2>
        <div className="card wide"><ActionForm action={addPurchaseAction}>
          <div className="grid3">
            <div><label>{m('المورد', 'Supplier')}</label><select name="supplierId">{active.map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
            <Field label={m('التاريخ', 'Date')} name="date" type="date" defaultValue={today} required />
            <Field label={m('رقم الفاتورة', 'Invoice no.')} name="invoiceNo" />
          </div>
          <table><thead><tr><th>{m('المنتج', 'Product')}</th><th>{m('الكمية', 'Qty')}</th><th>{m('سعر الوحدة', 'Unit cost')}</th></tr></thead><tbody>
            {[0, 1, 2, 3, 4, 5].map(i => <tr key={i}><td><select name={`p${i}`} defaultValue=""><option value="">—</option>{pOpts}</select></td><td><input name={`q${i}`} type="number" min={0} step="any" /></td><td><input name={`c${i}`} type="number" min={0} step="any" /></td></tr>)}
          </tbody></table>
          <div className="grid3">
            <Field label={m('المدفوع الآن (ج.م)', 'Paid now (EGP)')} name="paid" type="number" min={0} defaultValue={0} hint={m('الباقي يُسجَّل مستحقًا للمورد', 'The rest stays owed to the supplier')} />
            <div><label>{m('طريقة الدفع', 'Method')}</label><select name="method"><option value="cash">{m('نقدًا', 'Cash')}</option><option value="transfer">{m('تحويل', 'Transfer')}</option></select></div>
            <Field label={m('ملاحظة', 'Note')} name="note" />
          </div>
          <Submit>{m('تسجيل الفاتورة', 'Record invoice')}</Submit>
        </ActionForm></div>

        <h2 style={{ marginTop: 26 }}>{m('سداد دفعة لمورد', 'Pay a supplier')}</h2>
        <div className="card wide"><ActionForm action={paySupplierAction}>
          <div className="grid3">
            <div><label>{m('المورد', 'Supplier')}</label><select name="supplierId">{active.map((x: any) => <option key={x.id} value={x.id}>{x.name} ({owed(x.id)} {cur})</option>)}</select></div>
            <Field label={m('المبلغ', 'Amount')} name="amount" type="number" min={1} required />
            <Field label={m('التاريخ', 'Date')} name="date" type="date" defaultValue={today} required />
          </div>
          <div className="grid2"><div><label>{m('طريقة الدفع', 'Method')}</label><select name="method"><option value="cash">{m('نقدًا', 'Cash')}</option><option value="transfer">{m('تحويل', 'Transfer')}</option></select></div><Field label={m('ملاحظة', 'Note')} name="note" /></div>
          <Submit>{m('تسجيل الدفعة', 'Record payment')}</Submit>
        </ActionForm></div>
      </>}
      {(!active.length || !prods.length) && <p className="muted">{m('أضيفي مواردًا ومنتجات أولًا لتسجيل فواتير الشراء.', 'Add suppliers and products first to record purchase invoices.')}</p>}

      <h2 style={{ marginTop: 26 }}>{m('سجل الفواتير', 'Purchase history')}</h2>
      <table><thead><tr><th>{m('التاريخ', 'Date')}</th><th>{m('المورد', 'Supplier')}</th><th>{m('الفاتورة', 'Invoice')}</th><th>{m('الإجمالي', 'Total')}</th></tr></thead>
        <tbody>{purchases.map((p: any) => <tr key={p.id}><td>{p.date}</td><td>{sn(p.supplierId)}</td><td>{p.invoiceNo}</td><td>{p.total} {cur}</td></tr>)}{!purchases.length && <tr><td className="muted">—</td></tr>}</tbody></table>
    </>
  );
}
