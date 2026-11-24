import { notFound } from 'next/navigation';
import { and, asc, eq } from 'drizzle-orm';
import { requireCustomer } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds } from '@/lib/availability';
import { fmtDateTime } from '@/lib/time';
import { cancelBookingAction, submitProofAction } from '@/app/actions/booking';
import { ActionForm, Submit } from '@/components/forms';
import { CustomerHeader } from '@/components/CustomerHeader';
import { tagClass } from '@/lib/status';

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const c = await requireCustomer(); const { t, lang, settings } = await getI18n(); const cfg = bookingSettings(settings);
  const id = Number((await params).id); if (!id) notFound();
  const db = await getDb(); await expireHolds(db);
  const [b] = await db.select().from(s.bookings).where(and(eq(s.bookings.id, id), eq(s.bookings.customerId, c.id))); if (!b) notFound();
  const [st] = await db.select().from(s.staff).where(eq(s.staff.id, b.staffId));
  const pays = await db.select().from(s.payments).where(eq(s.payments.bookingId, b.id)).orderBy(asc(s.payments.createdAt));
  const [rec] = await db.select().from(s.recommendations).where(eq(s.recommendations.bookingId, b.id));
  const paid = pays.filter((p: any) => p.status === 'approved' && p.kind !== 'refund').reduce((a: number, p: any) => a + p.amount, 0);
  const last = pays.filter((p: any) => p.kind === 'deposit').at(-1);
  const cur = t('book.currency'), canCancel = ['pending_deposit', 'pending_confirmation', 'confirmed'].includes(b.status);
  const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const recRows: [string, string][] = rec ? [['book.rec_aftercare', rec.aftercare], ['book.rec_products', rec.productsRecommended], ['book.rec_usage', rec.usageInstructions], ['book.rec_avoid', rec.productsToAvoid], ['book.rec_next', rec.nextPrep]] : [];
  return (
    <>
      <CustomerHeader current="bookings" />
      <main className="page">
        <p><a href="/bookings">← {t('book.my_title')}</a></p>
        <h1>{lang === 'ar' ? b.serviceNameAr : b.serviceNameEn} <span className={`tag ${tagClass(b.status)}`}>{t(`book.status.${b.status}`)}</span></h1>
        <div className="card wide">
          <dl className="kv">
            <dt>{t('book.when')}</dt><dd>{fmtDateTime(b.startsAt, lang, cfg.tz)}</dd>
            <dt>{t('book.staff')}</dt><dd>{lang === 'ar' ? st?.nameAr : st?.nameEn}</dd>
            <dt>{t('book.price')}</dt><dd>{b.discountAmount > 0 && <s className="muted">{b.listPrice}</s>} {b.price} {cur}{b.offerName && <> <span className="tag ok">{b.offerName}</span></>}</dd>
            <dt>{t('book.deposit')}</dt><dd>{b.depositAmount} {cur} ({b.depositPercent}%)</dd>
            <dt>{t('book.paid')}</dt><dd>{paid} {cur}</dd>
            <dt>{t('book.remaining')}</dt><dd>{Math.max(0, b.price - paid)} {cur}</dd>
          </dl>
        </div>
        {b.status === 'pending_deposit' && (
          <div className="card wide" style={{ marginTop: 16 }}>
            <h2>{t('book.pay_title')}: {b.depositAmount} {cur}</h2>
            {b.holdExpiresAt && <p className="muted">{t('book.pay_hold')} {fmtDateTime(b.holdExpiresAt, lang, cfg.tz)}</p>}
            <p>{settings[`payment.instructions_${lang}`]}</p>
            {last?.status === 'rejected' && <div className="msg err">{t('book.pay_rejected')} {last.rejectReason || '-'}</div>}
            <ActionForm action={submitProofAction}>
              <input type="hidden" name="bookingId" value={b.id} />
              <div className="grid2">
                <div><label htmlFor="method">{t('book.pay_method')}</label><select id="method" name="method"><option>Vodafone Cash</option><option>InstaPay</option><option>{m('تحويل بنكي', 'Bank transfer')}</option></select></div>
                <div><label htmlFor="reference">{t('book.pay_ref')}</label><input id="reference" name="reference" required maxLength={120} dir="ltr" /></div>
              </div>
              <label htmlFor="proof">{t('book.pay_proof')}</label><input id="proof" name="proof" type="file" accept="image/png,image/jpeg,image/webp" required />
              <Submit>{t('book.pay_submit')}</Submit>
            </ActionForm>
          </div>)}
        {b.status === 'pending_confirmation' && last && <div className="msg ok" style={{ marginTop: 16 }}>{t('book.pay_waiting')}</div>}
        {b.status === 'cancelled' && b.cancelReason && b.cancelReason !== 'hold_expired' && <p className="muted">{b.cancelReason}</p>}
        {b.status === 'cancelled' && b.cancelReason === 'hold_expired' && <p className="muted">{m('انتهت مهلة دفع العربون وأُلغي الحجز تلقائيًا.', 'The deposit time limit passed and the booking was cancelled automatically.')}</p>}
        {rec && recRows.some(r => r[1]) && (
          <div className="card wide" style={{ marginTop: 16 }}><h2>{t('book.rec_title')}</h2>
            {recRows.filter(r => r[1]).map(([k, v]) => <div key={k}><h3 style={{ marginTop: 14 }}>{t(k)}</h3><p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{v}</p></div>)}</div>)}
        {canCancel && (
          <details className="box" style={{ marginTop: 16 }}><summary>{t('book.cancel')}</summary>
            <ActionForm action={cancelBookingAction}><input type="hidden" name="bookingId" value={b.id} />
              <label>{t('book.cancel_reason')}</label><textarea name="reason" rows={2} maxLength={300} />
              <Submit className="btn danger">{t('book.cancel')}</Submit></ActionForm></details>)}
      </main>
    </>
  );
}
