import { notFound } from 'next/navigation';
import { desc, eq } from 'drizzle-orm';
import { can, requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { addNoteAction } from '@/app/actions/staff';
import { ActionForm, Submit } from '@/components/forms';

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await requireStaff('customers.view'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const id = Number((await params).id); if (!id) notFound();
  const db = await getDb(); const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id)); if (!c) notFound();
  const notes = await db.select({ n: s.customerNotes, by: s.staff.nameEn, byAr: s.staff.nameAr }).from(s.customerNotes).leftJoin(s.staff, eq(s.staff.id, s.customerNotes.staffId)).where(eq(s.customerNotes.customerId, id)).orderBy(desc(s.customerNotes.createdAt));
  const bks = await db.select().from(s.bookings).where(eq(s.bookings.customerId, id));
  const pays = await db.select().from(s.payments).where(eq(s.payments.customerId, id));
  const recs = bks.length ? await db.select({ r: s.recommendations }).from(s.recommendations).innerJoin(s.bookings, eq(s.bookings.id, s.recommendations.bookingId)).where(eq(s.bookings.customerId, id)) : [];
  const SLb: Record<string, [string, string]> = { pending_deposit: ['بانتظار العربون', 'awaiting deposit'], pending_confirmation: ['بانتظار المراجعة', 'to review'], confirmed: ['مؤكد', 'confirmed'], completed: ['مكتمل', 'completed'], cancelled: ['ملغي', 'cancelled'] };
  const bn = (id: number) => { const b = bks.find((x: any) => x.id === id); return b ? (lang === 'ar' ? b.serviceNameAr : b.serviceNameEn) : ''; };
  const fmt = (d: any) => new Date(d).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const events = [
    { at: c.createdAt, text: m('تسجيل الحساب', 'Account registered') },
    c.verifiedAt && { at: c.verifiedAt, text: m('تم التحقق من الحساب', 'Account verified') },
    c.firstSessionDate && { at: c.firstSessionDate + 'T00:00:00', text: m('أول جلسة لها مع المركز (حسب إفادتها)', 'First session with the center (as stated)') },
    ...bks.map((b: any) => ({ at: b.startsAt, text: `${m('حجز', 'Booking')}: ${lang === 'ar' ? b.serviceNameAr : b.serviceNameEn} (${m(...SLb[b.status])}) · ${b.price} ${m('ج.م', 'EGP')}` })),
    ...pays.map((p: any) => ({ at: p.createdAt, text: `${p.kind === 'deposit' ? m('عربون', 'Deposit') : p.kind === 'refund' ? m('استرداد', 'Refund') : m('دفعة', 'Payment')} ${p.amount} ${m('ج.م', 'EGP')} (${p.status}) - ${bn(p.bookingId)}` })),
    ...recs.map((r: any) => ({ at: r.r.updatedAt, text: `${m('توصيات عناية', 'Care recommendations')} - ${bn(r.r.bookingId)}: ${r.r.aftercare}` })),
    ...notes.map((r: any) => ({ at: r.n.createdAt, text: `${m('ملاحظة داخلية', 'Internal note')} (${lang === 'ar' ? r.byAr : r.by}): ${r.n.body}` })),
  ].filter(Boolean).sort((a: any, b: any) => +new Date(b.at) - +new Date(a.at)) as { at: any; text: string }[];
  return (
    <>
      <p><a href="/admin/customers">← {m('العملاء', 'Customers')}</a></p>
      <h1>{c.name}</h1>
      <div className="card wide" style={{ marginBottom: 16 }}><div className="grid3">
        <div><div className="muted">{m('واتساب', 'WhatsApp')}</div><a dir="ltr" target="_blank" href={`https://wa.me/${c.whatsapp}`}>{c.whatsapp}</a></div>
        <div><div className="muted">{m('البريد', 'Email')}</div><span dir="ltr">{c.email}</span></div>
        <div><div className="muted">{m('التذكير الشهري', 'Monthly reminder')}</div>{c.reminderEnabled ? m(`كل ${c.reminderDay} يوم`, `every ${c.reminderDay} days`) : m('غير مفعّل', 'Off')}</div>
      </div></div>
      <h2>{m('الجدول الزمني', 'Timeline')}</h2>
      <table><tbody>{events.map((e, i) => <tr key={i}><td style={{ width: 190 }} className="muted">{fmt(e.at)}</td><td>{e.text}</td></tr>)}</tbody></table>
      {can(u, 'customers.manage') && <div className="card wide" style={{ marginTop: 16 }}><h3>{m('إضافة ملاحظة داخلية', 'Add internal note')}</h3>
        <ActionForm action={addNoteAction}><input type="hidden" name="customerId" value={c.id} /><textarea name="body" rows={3} required maxLength={2000} /><Submit>{m('إضافة', 'Add')}</Submit></ActionForm></div>}
    </>
  );
}
