import { eq } from 'drizzle-orm';
import { requireCustomer } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings } from '@/lib/availability';
import { loadOffers } from '@/lib/pricing';
import { todayIn } from '@/lib/time';
import { CustomerHeader } from '@/components/CustomerHeader';

export default async function Offers() {
  await requireCustomer(); const { t, lang, settings } = await getI18n(); const cfg = bookingSettings(settings);
  const db = await getDb();
  const offers = await loadOffers(db, todayIn(cfg.tz));
  const svcs = await db.select().from(s.services).where(eq(s.services.active, true));
  const L = (a: any, k: string) => a[k + (lang === 'ar' ? 'Ar' : 'En')] as string;
  return (
    <>
      <CustomerHeader current="offers" />
      <main className="page">
        <h1>{t('book.offers_title')}</h1>
        {!offers.length && <p className="muted">{t('book.offers_none')}</p>}
        {offers.map(o => (
          <div className="offer-card" key={o.id}>
            <h3 style={{ margin: 0 }}>{L(o, 'name')} <span className="tag ok">{o.percent > 0 ? `${o.percent}% ${t('book.off')}` : `${o.amountOff} ${t('book.currency')} ${t('book.off')}`}</span></h3>
            {L(o, 'desc') && <p style={{ margin: '6px 0' }}>{L(o, 'desc')}</p>}
            {o.serviceIds.length > 0 && <div className="muted">{svcs.filter((x: any) => o.serviceIds.includes(x.id)).map((x: any) => L(x, 'name')).join('، ')}</div>}
            {o.endDate && <div className="muted">{t('book.valid_until')} {o.endDate}</div>}
          </div>))}
        <a className="btn" style={{ maxWidth: 260 }} href="/sessions">{t('nav.sessions')}</a>
      </main>
    </>
  );
}
