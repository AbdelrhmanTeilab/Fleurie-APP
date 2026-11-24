import { notFound } from 'next/navigation';
import { asc, eq } from 'drizzle-orm';
import { can, requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds, findSlots } from '@/lib/availability';
import { fmtDateTime, isDateStr } from '@/lib/time';
import { tagClass } from '@/lib/status';
import { completeBookingAction, confirmBookingAction, recordPaymentAction, rescheduleAction, reviewPaymentAction, saveRecommendationAction, staffCancelBookingAction } from '@/app/actions/admin';
import { ActionForm, Field, Submit } from '@/components/forms';

const SL: Record<string, [string, string]> = { pending_deposit: ['بانتظار العربون', 'Awaiting deposit'], pending_confirmation: ['بانتظار المراجعة', 'To review'], confirmed: ['مؤكد', 'Confirmed'], completed: ['مكتمل', 'Completed'], cancelled: ['ملغي', 'Cancelled'] };
const PK: Record<string, [string, string]> = { deposit: ['عربون', 'Deposit'], balance: ['باقي المبلغ', 'Balance'], refund: ['استرداد', 'Refund'] };

export default async function BookingAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ rdate?: string }> }) {
  const u = await requireStaff(); const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en); const cfg = bookingSettings(settings);
  const id = Number((await params).id); if (!id) notFound(); const q = await searchParams;
  const db = await getDb(); await expireHolds(db);
  const [row] = await db.select({ b: s.bookings, c: s.customers }).from(s.bookings).innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId)).where(eq(s.bookings.id, id)); if (!row) notFound();
  const { b, c } = row;
  const all = can(u, 'bookings.all'); if (!all && !(can(u, 'bookings.own') && b.staffId === u.id)) notFound();
  const [st] = await db.select().from(s.staff).where(eq(s.staff.id, b.staffId));
  const pays = await db.select().from(s.payments).where(eq(s.payments.bookingId, id)).orderBy(asc(s.payments.createdAt));
  const [rec] = await db.select().from(s.recommendations).where(eq(s.recommendations.bookingId, id));
  const approved = pays.filter((p: any) => p.status === 'approved');
  const paid = approved.filter((p: any) => p.kind !== 'refund').reduce((a: number, p: any) => a + p.amount, 0) - approved.filter((p: any) => p.kind === 'refund').reduce((a: number, p: any) => a + p.amount, 0);
  const remaining = Math.max(0, b.price - paid), cur = m('ج.م', 'EGP');
  const live = ['pending_deposit', 'pending_confirmation', 'confirmed'].includes(b.status);
  const rdate = q.rdate && isDateStr(q.rdate) ? q.rdate : '';
  let slots: any[] = [];
  if (all && live && rdate) { const [svc] = await db.select().from(s.services).where(eq(s.services.id, b.serviceId)); slots = await findSlots(db, svc, rdate, cfg, { ignoreBookingId: b.id }); }
  const canPay = can(u, 'payments.manage'), canRec = can(u, 'recommendations.write') && ['confirmed', 'completed'].includes(b.status);
  return (
    <>
      <p><a href="/admin/bookings">← {m('الحجوزات', 'Bookings')}</a></p>
      <h1>{lang === 'ar' ? b.serviceNameAr : b.serviceNameEn} <span className={`tag ${tagClass(b.status)}`}>{m(...SL[b.status])}</span></h1>
      <div className="card wide">
        <dl className="kv">
          <dt>{m('الموعد', 'When')}</dt><dd>{fmtDateTime(b.startsAt, lang, cfg.tz)}</dd>
          <dt>{m('العميلة', 'Customer')}</dt><dd>{can(u, 'customers.view') ? <a href={`/admin/customers/${c.id}`}>{c.name}</a> : c.name}{can(u, 'customers.view') && <> · <a dir="ltr" target="_blank" href={`https://wa.me/${c.whatsapp}`}>{c.whatsapp}</a></>}</dd>
          <dt>{m('الأخصائية', 'Specialist')}</dt><dd>{lang === 'ar' ? st.nameAr : st.nameEn}</dd>
          <dt>{m('السعر', 'Price')}</dt><dd>{b.discountAmount > 0 && <s className="muted">{b.listPrice}</s>} {b.price} {cur}{b.offerName && <> <span className="tag ok">{b.offerName}</span></>}</dd>
          <dt>{m('العربون', 'Deposit')}</dt><dd>{b.depositAmount} {cur} ({b.depositPercent}%)</dd>
          <dt>{m('المدفوع (معتمد)', 'Paid (approved)')}</dt><dd>{paid} {cur}</dd>
          <dt>{m('المتبقي', 'Remaining')}</dt><dd><b>{remaining} {cur}</b></dd>
          {b.customerNote && <><dt>{m('ملاحظة العميلة', 'Customer note')}</dt><dd>{b.customerNote}</dd></>}
          {b.status === 'cancelled' && <><dt>{m('الإلغاء', 'Cancelled')}</dt><dd>{b.cancelledBy} {b.cancelReason && `· ${b.cancelReason}`}</dd></>}
        </dl>
      </div>

      {pays.length > 0 && <><h2 style={{ marginTop: 22 }}>{m('المدفوعات', 'Payments')}</h2>
        <table><thead><tr><th>{m('النوع', 'Type')}</th><th>{m('المبلغ', 'Amount')}</th><th>{m('الطريقة / المرجع', 'Method / reference')}</th><th>{m('الإثبات', 'Proof')}</th><th>{m('الحالة', 'Status')}</th><th></th></tr></thead><tbody>
          {pays.map((p: any) => (<tr key={p.id}><td>{m(...PK[p.kind])}</td><td>{p.amount} {cur}</td><td>{p.method}<div className="muted" dir="ltr">{p.reference}</div></td>
            <td>{p.proofFile && canPay ? <a href={`/proof/${p.proofFile}`} target="_blank"><img className="proof" src={`/proof/${p.proofFile}`} alt="proof" style={{ maxWidth: 110 }} /></a> : '-'}</td>
            <td><span className={`tag ${tagClass(p.status)}`}>{p.status === 'submitted' ? m('بانتظار المراجعة', 'To review') : p.status === 'approved' ? m('معتمد', 'Approved') : m('مرفوض', 'Rejected')}</span>{p.rejectReason && <div className="muted">{p.rejectReason}</div>}</td>
            <td>{p.status === 'submitted' && canPay && (<ActionForm action={reviewPaymentAction}><input type="hidden" name="paymentId" value={p.id} /><input name="reason" placeholder={m('سبب الرفض (إن وُجد)', 'Reject reason (if any)')} style={{ marginBottom: 6 }} />
              <div style={{ display: 'flex', gap: 6 }}><button className="btn sm" name="decision" value="approve">{m('اعتماد', 'Approve')}</button><button className="btn sm danger" name="decision" value="reject">{m('رفض', 'Reject')}</button></div></ActionForm>)}</td></tr>))}
        </tbody></table></>}

      <div className="card wide" style={{ marginTop: 18 }}>
        <h3>{m('إجراءات', 'Actions')}</h3>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {all && ['pending_confirmation', 'pending_deposit'].includes(b.status) && b.depositAmount === 0 && <ActionForm action={confirmBookingAction}><input type="hidden" name="bookingId" value={b.id} /><Submit className="btn sm">{m('تأكيد الحجز', 'Confirm booking')}</Submit></ActionForm>}
          {b.status === 'confirmed' && <ActionForm action={completeBookingAction}><input type="hidden" name="bookingId" value={b.id} /><Submit className="btn sm">{m('تمت الجلسة', 'Mark completed')}</Submit></ActionForm>}
        </div>
        {canPay && ['confirmed', 'completed'].includes(b.status) && remaining > 0 && (<>
          <h3 style={{ marginTop: 18 }}>{m('تسجيل دفعة مستلمة', 'Record a payment received')}</h3>
          <ActionForm action={recordPaymentAction}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="kind" value="balance" />
            <div className="grid3"><Field label={m('المبلغ', 'Amount')} name="amount" type="number" min={1} max={remaining} defaultValue={remaining} required />
              <div><label>{m('الطريقة', 'Method')}</label><select name="method"><option value="cash">{m('نقدًا', 'Cash')}</option><option>Vodafone Cash</option><option>InstaPay</option><option value="card">{m('بطاقة', 'Card')}</option></select></div>
              <Field label={m('مرجع (اختياري)', 'Reference (optional)')} name="reference" /></div>
            <Submit>{m('تسجيل', 'Record')}</Submit></ActionForm></>)}
        {canPay && paid > 0 && (<details style={{ marginTop: 14 }}><summary>{m('تسجيل استرداد', 'Record a refund')}</summary>
          <ActionForm action={recordPaymentAction}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="kind" value="refund" />
            <div className="grid3"><Field label={m('المبلغ', 'Amount')} name="amount" type="number" min={1} max={paid} required /><Field label={m('الطريقة', 'Method')} name="method" defaultValue="Vodafone Cash" /><Field label={m('مرجع', 'Reference')} name="reference" /></div>
            <Submit className="btn danger">{m('تسجيل الاسترداد', 'Record refund')}</Submit></ActionForm></details>)}
        {all && live && (<details style={{ marginTop: 14 }} open={!!rdate}><summary>{m('تغيير الموعد', 'Reschedule')}</summary>
          <form method="get" style={{ display: 'flex', gap: 10, alignItems: 'end' }}><div style={{ flex: 1 }}><label>{m('اليوم الجديد', 'New day')}</label><input type="date" name="rdate" defaultValue={rdate} required /></div><button className="btn sm">{m('عرض المواعيد', 'Show times')}</button></form>
          {rdate && (slots.length ? <ActionForm action={rescheduleAction}><input type="hidden" name="bookingId" value={b.id} /><input type="hidden" name="date" value={rdate} />
            <div className="slots">{slots.map((sl: any) => <label key={sl.time}><input type="radio" name="time" value={sl.time} required />{sl.time}</label>)}</div><Submit>{m('نقل الحجز', 'Move booking')}</Submit></ActionForm> : <div className="msg err">{m('لا توجد مواعيد', 'No times available')}</div>)}</details>)}
        {all && live && (<details style={{ marginTop: 14 }}><summary>{m('إلغاء الحجز', 'Cancel booking')}</summary>
          <ActionForm action={staffCancelBookingAction}><input type="hidden" name="bookingId" value={b.id} /><label>{m('السبب', 'Reason')}</label><textarea name="reason" rows={2} maxLength={300} /><Submit className="btn danger">{m('تأكيد الإلغاء', 'Confirm cancellation')}</Submit></ActionForm></details>)}
      </div>

      {canRec && (<div className="card wide" style={{ marginTop: 18 }}><h3>{m('توصيات العناية للعميلة', 'Care recommendations for the customer')}</h3>
        <ActionForm action={saveRecommendationAction}><input type="hidden" name="bookingId" value={b.id} />
          <div className="grid2">
            <div><label>{m('العناية بعد الجلسة', 'Aftercare')}</label><textarea name="aftercare" rows={3} defaultValue={rec?.aftercare} /></div>
            <div><label>{m('المنتجات الموصى بها', 'Recommended products')}</label><textarea name="productsRecommended" rows={3} defaultValue={rec?.productsRecommended} /></div>
            <div><label>{m('طريقة الاستخدام', 'How to use')}</label><textarea name="usageInstructions" rows={3} defaultValue={rec?.usageInstructions} /></div>
            <div><label>{m('منتجات يجب تجنبها', 'Products to avoid')}</label><textarea name="productsToAvoid" rows={3} defaultValue={rec?.productsToAvoid} /></div>
          </div>
          <label>{m('التحضير للجلسة القادمة', 'Preparation for the next session')}</label><textarea name="nextPrep" rows={2} defaultValue={rec?.nextPrep} />
          <Submit>{m('حفظ وإرسال إشعار', 'Save and notify')}</Submit></ActionForm></div>)}
    </>
  );
}
