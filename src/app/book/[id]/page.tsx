import { notFound } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { requireCustomer } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds, findSlots } from '@/lib/availability';
import { depositFor, loadOffers, priceFor } from '@/lib/pricing';
import { addDays, isDateStr, todayIn } from '@/lib/time';
import { createBookingAction } from '@/app/actions/booking';
import { ActionForm, Submit } from '@/components/forms';
import { CustomerHeader } from '@/components/CustomerHeader';

export default async function Book({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  await requireCustomer(); const { t, lang, settings } = await getI18n(); const cfg = bookingSettings(settings);
  const id = Number((await params).id); const q = await searchParams;
  const db = await getDb(); await expireHolds(db);
  const [sv] = await db.select().from(s.services).where(and(eq(s.services.id, id), eq(s.services.active, true))); if (!sv) notFound();
  const today = todayIn(cfg.tz), date = q.date && isDateStr(q.date) ? q.date : '';
  const slots = date ? await findSlots(db, sv, date, cfg) : [];
  const p = priceFor(sv, await loadOffers(db, today)); const dep = depositFor(p.price, sv.depositPercent ?? cfg.depositDefault);
  const name = lang === 'ar' ? sv.nameAr : sv.nameEn;
  return (
    <>
      <CustomerHeader current="sessions" />
      <main className="page">
        <p><a href="/sessions">← {t('nav.sessions')}</a></p>
        <h1>{name}</h1>
        <div className="muted">{sv.durationMin} {t('book.duration')} · <span className="price">{p.discount > 0 && <s>{p.listPrice}</s>}{p.price} {t('book.currency')}</span> · {t('book.deposit')}: {dep} {t('book.currency')}</div>
        <div className="card wide" style={{ marginTop: 18 }}>
          <form method="get"><label htmlFor="date">{t('book.pick_date')}</label>
            <div style={{ display: 'flex', gap: 10 }}><input id="date" type="date" name="date" min={today} max={addDays(today, cfg.maxDays)} defaultValue={date} required /><button className="btn sm" style={{ whiteSpace: 'nowrap' }}>{t('book.show_times')}</button></div></form>
          {date && (slots.length === 0 ? <div className="msg err">{t('book.no_slots')}</div> : (
            <ActionForm action={createBookingAction}>
              <input type="hidden" name="serviceId" value={sv.id} /><input type="hidden" name="date" value={date} />
              <label>{t('book.pick_time')}</label>
              <div className="slots">{slots.map((sl, i) => <label key={sl.time}><input type="radio" name="time" value={sl.time} required defaultChecked={i === 0 && false} />{sl.time}</label>)}</div>
              <label htmlFor="note">{t('book.note')}</label><textarea id="note" name="note" rows={2} maxLength={500} />
              <Submit>{t('book.confirm')}</Submit>
            </ActionForm>))}
        </div>
      </main>
    </>
  );
}
