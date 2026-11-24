import { asc, desc, eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { fmtDateTime } from '@/lib/time';
import { bookingSettings } from '@/lib/availability';
import { adjustStockAction, linkServiceProductAction, saveProductAction, unlinkServiceProductAction } from '@/app/actions/ops';
import { ActionForm, Field, Submit } from '@/components/forms';

type M = (a: string, e: string) => string;
function ProductForm({ p, sups, m }: { p?: any; sups: any[]; m: M }) {
  return (
    <ActionForm action={saveProductAction}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid3">
        <Field label={m('الاسم بالعربية', 'Name (Arabic)')} name="nameAr" defaultValue={p?.nameAr} required />
        <Field label={m('الاسم بالإنجليزية', 'Name (English)')} name="nameEn" defaultValue={p?.nameEn} required dir="ltr" />
        <Field label={m('الوحدة (مل، عبوة...)', 'Unit (ml, pcs...)')} name="unit" defaultValue={p?.unit ?? 'pcs'} />
        <Field label={m('الكود (اختياري)', 'SKU (optional)')} name="sku" defaultValue={p?.sku} dir="ltr" />
        <Field label={m('حد التنبيه (ينبّه عند الوصول له أو أقل)', 'Reorder level (alert at or below)')} name="reorderLevel" type="number" min={0} step="any" defaultValue={p?.reorderLevel ?? 0} />
        <div><label>{m('المورد', 'Supplier')}</label><select name="supplierId" defaultValue={p?.supplierId ?? ''}><option value="">—</option>{sups.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></div>
        {!p && <Field label={m('الكمية الحالية', 'Opening quantity')} name="openingQty" type="number" min={0} step="any" defaultValue={0} />}
        {!p && <Field label={m('تكلفة الوحدة (ج.م)', 'Unit cost (EGP)')} name="openingCost" type="number" min={0} step="any" defaultValue={0} />}
      </div>
      <div className="check"><input type="checkbox" id={`pa${p?.id ?? 'n'}`} name="active" defaultChecked={p ? p.active : true} /><label style={{ margin: 0 }} htmlFor={`pa${p?.id ?? 'n'}`}>{m('نشط', 'Active')}</label></div>
      <Submit>{m('حفظ', 'Save')}</Submit>
    </ActionForm>
  );
}

export default async function Inventory() {
  await requireStaff('inventory.manage'); const { lang, settings } = await getI18n(); const m: M = (ar, en) => (lang === 'ar' ? ar : en);
  const cfg = bookingSettings(settings), db = await getDb(), cur = m('ج.م', 'EGP');
  const prods = await db.select().from(s.products).orderBy(asc(s.products.nameEn));
  const sups = await db.select().from(s.suppliers).orderBy(asc(s.suppliers.name));
  const svcs = await db.select().from(s.services).orderBy(asc(s.services.id));
  const links = await db.select().from(s.serviceProducts);
  const moves = await db.select().from(s.stockMovements).orderBy(desc(s.stockMovements.id)).limit(25);
  const pn = (id: number) => { const p = prods.find((x: any) => x.id === id); return p ? (lang === 'ar' ? p.nameAr : p.nameEn) : '#' + id; };
  const low = prods.filter((p: any) => p.active && p.stock <= p.reorderLevel);
  const value = Math.round(prods.reduce((a: number, p: any) => a + Math.max(0, p.stock) * p.avgCost, 0));
  const kindLabel: Record<string, string> = { purchase: m('شراء', 'Purchase'), consume: m('استهلاك جلسة', 'Used in session'), adjust: m('تعديل', 'Adjustment'), waste: m('تالف', 'Waste') };
  return (
    <>
      <h1>{m('المخزون', 'Inventory')}</h1>
      <div className="stats">
        <div className="stat">{m('عدد المنتجات', 'Products')}<b>{prods.length}</b></div>
        <div className="stat">{m('قيمة المخزون', 'Stock value')}<b>{value}</b><span className="muted">{cur}</span></div>
        <div className="stat">{m('منتجات ناقصة', 'Low stock')}<b>{low.length}</b></div>
      </div>
      {low.length > 0 && <div className="msg err">{m('تحتاج إعادة طلب: ', 'Needs reordering: ')}{low.map((p: any) => pn(p.id)).join('، ')}</div>}

      <details className="box" open={!prods.length}><summary>+ {m('إضافة منتج', 'Add a product')}</summary><ProductForm sups={sups} m={m} /></details>
      <table>
        <thead><tr><th>{m('المنتج', 'Product')}</th><th>{m('المتوفر', 'In stock')}</th><th>{m('متوسط التكلفة', 'Avg. cost')}</th><th>{m('حد التنبيه', 'Reorder at')}</th><th></th></tr></thead>
        <tbody>{prods.map((p: any) => (
          <tr key={p.id}><td>{pn(p.id)} {!p.active && <span className="tag bad">{m('موقوف', 'Inactive')}</span>}</td>
            <td><b>{+p.stock.toFixed(2)}</b> {p.unit} {p.stock <= p.reorderLevel && p.active && <span className="tag warn">{p.stock < 0 ? m('بالسالب', 'Negative') : m('ناقص', 'Low')}</span>}</td>
            <td>{+p.avgCost.toFixed(2)} {cur}</td><td>{p.reorderLevel}</td><td></td></tr>))}
          {!prods.length && <tr><td className="muted">{m('لا توجد منتجات بعد', 'No products yet')}</td></tr>}</tbody>
      </table>
      {prods.map((p: any) => <details className="box" key={p.id}><summary>{m('تعديل: ', 'Edit: ')}{pn(p.id)}</summary><ProductForm p={p} sups={sups} m={m} /></details>)}

      {prods.length > 0 && <>
        <h2 style={{ marginTop: 26 }}>{m('تعديل المخزون / تالف', 'Adjust stock / waste')}</h2>
        <div className="card wide"><ActionForm action={adjustStockAction}>
          <div className="grid3">
            <div><label>{m('المنتج', 'Product')}</label><select name="productId">{prods.map((p: any) => <option key={p.id} value={p.id}>{pn(p.id)}</option>)}</select></div>
            <div><label>{m('النوع', 'Type')}</label><select name="kind"><option value="adjust">{m('جرد (+ أو -)', 'Count correction (+ or -)')}</option><option value="waste">{m('تالف / منتهي (يخصم)', 'Waste / expired (deducts)')}</option></select></div>
            <Field label={m('الكمية', 'Quantity')} name="qty" type="number" step="any" required />
          </div>
          <Field label={m('السبب (إجباري)', 'Reason (required)')} name="note" required />
          <Submit>{m('تسجيل', 'Record')}</Submit>
        </ActionForm></div>

        <h2 style={{ marginTop: 26 }}>{m('استهلاك المنتجات في الجلسات', 'Products used per session')}</h2>
        <p className="muted">{m('عند إكمال الجلسة يُخصم هذا الاستهلاك من المخزون تلقائيًا.', 'When a session is completed, this usage is deducted from stock automatically.')}</p>
        <div className="card wide"><ActionForm action={linkServiceProductAction}>
          <div className="grid3">
            <div><label>{m('الجلسة', 'Session')}</label><select name="serviceId">{svcs.map((x: any) => <option key={x.id} value={x.id}>{lang === 'ar' ? x.nameAr : x.nameEn}</option>)}</select></div>
            <div><label>{m('المنتج', 'Product')}</label><select name="productId">{prods.map((p: any) => <option key={p.id} value={p.id}>{pn(p.id)}</option>)}</select></div>
            <Field label={m('الكمية لكل جلسة', 'Quantity per session')} name="qty" type="number" min={0} step="any" required />
          </div>
          <Submit>{m('ربط / تحديث', 'Link / update')}</Submit>
        </ActionForm></div>
        <table><tbody>{links.map((l: any) => { const sv = svcs.find((x: any) => x.id === l.serviceId); return (
          <tr key={l.serviceId + '-' + l.productId}><td>{sv ? (lang === 'ar' ? sv.nameAr : sv.nameEn) : '#' + l.serviceId}</td><td>{pn(l.productId)}</td><td>{l.qty}</td>
            <td><form action={unlinkServiceProductAction}><input type="hidden" name="serviceId" value={l.serviceId} /><input type="hidden" name="productId" value={l.productId} /><button className="btn sm danger">{m('إزالة', 'Remove')}</button></form></td></tr>); })}
          {!links.length && <tr><td className="muted">{m('لا يوجد ربط بعد', 'Nothing linked yet')}</td></tr>}</tbody></table>
      </>}

      <h2 style={{ marginTop: 26 }}>{m('آخر حركات المخزون', 'Recent stock movements')}</h2>
      <table><tbody>{moves.map((x: any) => (
        <tr key={x.id}><td>{fmtDateTime(x.createdAt, lang, cfg.tz)}</td><td>{pn(x.productId)}</td><td><span className="tag">{kindLabel[x.kind] ?? x.kind}</span></td><td dir="ltr">{x.qty > 0 ? '+' : ''}{+x.qty.toFixed(2)}</td><td className="muted">{x.note}</td></tr>))}
        {!moves.length && <tr><td className="muted">—</td></tr>}</tbody></table>
    </>
  );
}
