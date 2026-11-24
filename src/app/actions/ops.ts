'use server';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { requireStaff, type StaffUser } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { isDateStr } from '@/lib/time';
import { logAction } from '@/lib/audit';

type FormState = { error?: string; ok?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const num = (f: FormData, k: string) => { const v = Number(str(f, k).replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
const actor = (u: StaffUser) => ({ kind: 'staff' as const, id: u.id, name: u.nameEn });
async function M() { const { lang } = await getI18n(); return (ar: string, en: string) => (lang === 'ar' ? ar : en); }
import { EXPENSE_CATS } from '@/lib/expenseCats';

// ---------- products ----------
export async function saveProductAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('inventory.manage'); const m = await M();
  const id = Number(str(f, 'id')) || 0, sup = Number(str(f, 'supplierId')) || null;
  const v = { nameAr: str(f, 'nameAr').slice(0, 120), nameEn: str(f, 'nameEn').slice(0, 120), unit: str(f, 'unit').slice(0, 20) || 'pcs', sku: str(f, 'sku').slice(0, 40), reorderLevel: num(f, 'reorderLevel') || 0, supplierId: sup, active: f.get('active') === 'on' };
  if (!v.nameAr || !v.nameEn) return { error: m('أدخلي اسم المنتج بالعربية والإنجليزية', 'Enter the product name in Arabic and English') };
  if (v.reorderLevel < 0) return { error: m('حد إعادة الطلب غير صحيح', 'Invalid reorder level') };
  const db = await getDb();
  if (id) await db.update(s.products).set(v).where(eq(s.products.id, id));
  else {
    const qty = num(f, 'openingQty') || 0, cost = num(f, 'openingCost') || 0;
    if (qty < 0 || cost < 0) return { error: m('الكمية والتكلفة لا تكونان سالبتين', 'Quantity and cost cannot be negative') };
    const [p] = await db.insert(s.products).values({ ...v, stock: qty, avgCost: cost }).returning();
    if (qty > 0) await db.insert(s.stockMovements).values({ productId: p.id, kind: 'adjust', qty, unitCost: cost, staffId: u.id, note: 'opening balance' });
  }
  await logAction(actor(u), id ? 'product.update' : 'product.create', 'product', id || v.nameEn);
  revalidatePath('/admin/inventory');
  return { ok: m('تم الحفظ', 'Saved') };
}
export async function adjustStockAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('inventory.manage'); const m = await M();
  const id = Number(str(f, 'productId')), kind = str(f, 'kind') === 'waste' ? 'waste' : 'adjust'; let qty = num(f, 'qty');
  if (!id || !Number.isFinite(qty) || qty === 0) return { error: m('أدخلي كمية صحيحة', 'Enter a valid quantity') };
  if (kind === 'waste') qty = -Math.abs(qty);
  if (!str(f, 'note')) return { error: m('اكتبي سببًا', 'Please give a reason') };
  const db = await getDb(); const [p] = await db.select().from(s.products).where(eq(s.products.id, id)); if (!p) return { error: m('المنتج غير موجود', 'Product not found') };
  await db.update(s.products).set({ stock: sql`${s.products.stock} + ${qty}` }).where(eq(s.products.id, id));
  await db.insert(s.stockMovements).values({ productId: id, kind, qty, unitCost: p.avgCost, staffId: u.id, note: str(f, 'note').slice(0, 200) });
  await logAction(actor(u), `stock.${kind}`, 'product', id, { qty });
  revalidatePath('/admin/inventory');
  return { ok: m('تم تعديل المخزون', 'Stock updated') };
}
export async function linkServiceProductAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('inventory.manage'); const m = await M();
  const serviceId = Number(str(f, 'serviceId')), productId = Number(str(f, 'productId')), qty = num(f, 'qty');
  if (!serviceId || !productId || !(qty > 0)) return { error: m('اختاري الجلسة والمنتج والكمية', 'Choose the session, product and quantity') };
  const db = await getDb();
  await db.delete(s.serviceProducts).where(and(eq(s.serviceProducts.serviceId, serviceId), eq(s.serviceProducts.productId, productId)));
  await db.insert(s.serviceProducts).values({ serviceId, productId, qty });
  await logAction(actor(u), 'service_product.set', 'service', serviceId, { productId, qty });
  revalidatePath('/admin/inventory');
  return { ok: m('تم الربط', 'Linked') };
}
export async function unlinkServiceProductAction(f: FormData) {
  const u = await requireStaff('inventory.manage'); const db = await getDb();
  await db.delete(s.serviceProducts).where(and(eq(s.serviceProducts.serviceId, Number(str(f, 'serviceId'))), eq(s.serviceProducts.productId, Number(str(f, 'productId')))));
  await logAction(actor(u), 'service_product.remove', 'service', str(f, 'serviceId')); revalidatePath('/admin/inventory');
}

// ---------- suppliers & purchases ----------
export async function saveSupplierAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('suppliers.manage'); const m = await M();
  const id = Number(str(f, 'id')) || 0; const v = { name: str(f, 'name').slice(0, 120), phone: str(f, 'phone').slice(0, 30), email: str(f, 'email').slice(0, 120), notes: str(f, 'notes').slice(0, 500), active: f.get('active') === 'on' };
  if (!v.name) return { error: m('أدخلي اسم المورد', 'Enter the supplier name') };
  const db = await getDb();
  if (id) await db.update(s.suppliers).set(v).where(eq(s.suppliers.id, id)); else await db.insert(s.suppliers).values(v);
  await logAction(actor(u), id ? 'supplier.update' : 'supplier.create', 'supplier', id || v.name); revalidatePath('/admin/suppliers');
  return { ok: m('تم الحفظ', 'Saved') };
}
export async function addPurchaseAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('suppliers.manage'); const m = await M();
  const supplierId = Number(str(f, 'supplierId')), date = str(f, 'date'), paid = Math.round(num(f, 'paid') || 0);
  if (!supplierId || !isDateStr(date)) return { error: m('اختاري التاريخ', 'Choose the date') };
  const lines: { productId: number; qty: number; cost: number }[] = [];
  for (let i = 0; i < 6; i++) { const productId = Number(str(f, `p${i}`)), qty = num(f, `q${i}`), cost = num(f, `c${i}`); if (!productId && !str(f, `q${i}`)) continue; if (!productId || !(qty > 0) || !(cost >= 0)) return { error: m(`تأكدي من البند رقم ${i + 1}`, `Check line ${i + 1}`) }; lines.push({ productId, qty, cost }); }
  if (!lines.length) return { error: m('أضيفي بندًا واحدًا على الأقل', 'Add at least one line') };
  const total = Math.round(lines.reduce((a, l) => a + l.qty * l.cost, 0));
  if (paid < 0 || paid > total) return { error: m('المدفوع أكبر من إجمالي الفاتورة', 'Paid is more than the invoice total') };
  const db = await getDb(); let pid = 0;
  await db.transaction(async (tx: any) => {
    const [pu] = await tx.insert(s.purchases).values({ supplierId, invoiceNo: str(f, 'invoiceNo').slice(0, 40), date, total, note: str(f, 'note').slice(0, 300), staffId: u.id }).returning(); pid = pu.id;
    for (const l of lines) {
      const [p] = await tx.select().from(s.products).where(eq(s.products.id, l.productId)); if (!p) throw new Error('product');
      const base = Math.max(0, p.stock), newStock = p.stock + l.qty;
      const avg = base + l.qty > 0 ? (base * p.avgCost + l.qty * l.cost) / (base + l.qty) : l.cost; // moving average cost
      await tx.update(s.products).set({ stock: newStock, avgCost: avg }).where(eq(s.products.id, p.id));
      await tx.insert(s.stockMovements).values({ productId: p.id, kind: 'purchase', qty: l.qty, unitCost: l.cost, purchaseId: pu.id, staffId: u.id });
    }
    if (paid > 0) await tx.insert(s.expenses).values({ date, category: 'supplier_payment', amount: paid, method: str(f, 'method') || 'cash', supplierId, purchaseId: pu.id, note: 'invoice payment', staffId: u.id });
  });
  await logAction(actor(u), 'purchase.create', 'purchase', pid, { total, paid });
  revalidatePath('/admin/suppliers'); revalidatePath('/admin/inventory');
  return { ok: m(`تم تسجيل الفاتورة بإجمالي ${total} ج.م`, `Purchase recorded: ${total} EGP`) };
}
export async function paySupplierAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('suppliers.manage'); const m = await M();
  const supplierId = Number(str(f, 'supplierId')), amount = Math.round(num(f, 'amount')), date = str(f, 'date');
  if (!supplierId || !(amount > 0) || !isDateStr(date)) return { error: m('تأكدي من المبلغ والتاريخ', 'Check the amount and date') };
  const db = await getDb();
  const bought = (await db.select().from(s.purchases).where(eq(s.purchases.supplierId, supplierId))).reduce((a: number, p: any) => a + p.total, 0);
  const paid = (await db.select().from(s.expenses).where(and(eq(s.expenses.supplierId, supplierId), eq(s.expenses.category, 'supplier_payment')))).reduce((a: number, p: any) => a + p.amount, 0);
  if (amount > bought - paid) return { error: m('المبلغ أكبر من المستحق للمورد', 'Amount is more than what is owed'), };
  await db.insert(s.expenses).values({ date, category: 'supplier_payment', amount, method: str(f, 'method') || 'cash', supplierId, note: str(f, 'note').slice(0, 200), staffId: u.id });
  await logAction(actor(u), 'supplier.pay', 'supplier', supplierId, { amount }); revalidatePath('/admin/suppliers'); revalidatePath('/admin/finance');
  return { ok: m('تم تسجيل الدفعة', 'Payment recorded') };
}

// ---------- expenses ----------
export async function addExpenseAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('finance.view'); const m = await M();
  const amount = Math.round(num(f, 'amount')), date = str(f, 'date'), category = str(f, 'category');
  if (!(amount > 0) || amount > 10_000_000 || !isDateStr(date) || !EXPENSE_CATS.includes(category)) return { error: m('تأكدي من المبلغ والتاريخ والتصنيف', 'Check amount, date and category') };
  const db = await getDb(); await db.insert(s.expenses).values({ date, category, amount, method: str(f, 'method') || 'cash', note: str(f, 'note').slice(0, 300), staffId: u.id });
  await logAction(actor(u), 'expense.add', 'expense', category, { amount }); revalidatePath('/admin/finance');
  return { ok: m('تم تسجيل المصروف', 'Expense recorded') };
}
export async function deleteExpenseAction(f: FormData) {
  const u = await requireStaff('finance.view'); const db = await getDb(); const id = Number(str(f, 'id'));
  const [e] = await db.select().from(s.expenses).where(eq(s.expenses.id, id));
  if (!e || e.category === 'supplier_payment') return; // supplier payments are corrected through the supplier page
  await db.delete(s.expenses).where(eq(s.expenses.id, id)); await logAction(actor(u), 'expense.delete', 'expense', id, { amount: e.amount, category: e.category }); revalidatePath('/admin/finance');
}

// ---------- messages ----------
import { TEMPLATES } from '@/lib/templates';
import { runReminders, announceOffer } from '@/lib/reminders';
import { getSettings } from '@/lib/i18n';
export async function saveTemplateAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('settings.manage'); const m = await M(); const key = str(f, 'key'); const def = TEMPLATES.find(t => t.key === key);
  if (!def) return { error: m('قالب غير معروف', 'Unknown template') };
  const db = await getDb();
  for (const l of ['ar', 'en'] as const) {
    const v = String(f.get(l) ?? '').trim().slice(0, 600), k = `msg.${key}.${l}`;
    if (!v || v === def[l]) await db.delete(s.siteSettings).where(eq(s.siteSettings.key, k));
    else await db.insert(s.siteSettings).values({ key: k, value: v }).onConflictDoUpdate({ target: s.siteSettings.key, set: { value: v } });
  }
  await logAction(actor(u), 'template.save', 'template', key); revalidatePath('/admin/messages');
  return { ok: m('تم حفظ القالب', 'Template saved') };
}
export async function runRemindersAction(_: FormState, __: FormData): Promise<FormState> {
  const u = await requireStaff('customers.manage'); const m = await M();
  const r = await runReminders(await getDb(), await getSettings());
  await logAction(actor(u), 'reminders.run', 'reminders', '', r); revalidatePath('/admin/outbox');
  return { ok: m(`تم: ${r.routine} تذكير دوري و ${r.appointments} تذكير بموعد`, `Done: ${r.routine} routine and ${r.appointments} appointment reminders`) };
}
export async function announceOfferAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('services.manage'); const m = await M();
  const id = Number(str(f, 'id')), db = await getDb();
  const r = await announceOffer(db, await getSettings(), id);
  await logAction(actor(u), 'offer.announce', 'offer', id, r); revalidatePath('/admin/outbox');
  return { ok: m(`تم تجهيز ${r.sent} رسالة (${r.skipped} سبق إرسالها)`, `${r.sent} messages queued (${r.skipped} already sent)`) };
}
export async function saveSiteUrlAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('settings.manage'); const m = await M(); const v = str(f, 'url').replace(/\/$/, '');
  if (!/^https?:\/\/[^\s]+$/.test(v)) return { error: m('اكتبي رابطًا صحيحًا يبدأ بـ https://', 'Enter a valid link starting with https://') };
  const db = await getDb(); await db.insert(s.siteSettings).values({ key: 'site.url', value: v }).onConflictDoUpdate({ target: s.siteSettings.key, set: { value: v } });
  await logAction(actor(u), 'settings.site_url', 'settings', 'site.url'); revalidatePath('/admin/messages');
  return { ok: m('تم الحفظ', 'Saved') };
}
