import { desc, eq } from 'drizzle-orm';
import { requireCustomer } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds } from '@/lib/availability';
import { fmtDateTime } from '@/lib/time';
import { tagClass } from '@/lib/status';
import { CustomerHeader } from '@/components/CustomerHeader';


export default async function MyBookings() {
  const c = await requireCustomer(); const { t, lang, settings } = await getI18n(); const cfg = bookingSettings(settings);
  const db = await getDb(); await expireHolds(db);
  const rows = await db.select().from(s.bookings).where(eq(s.bookings.customerId, c.id)).orderBy(desc(s.bookings.startsAt));
  const now = Date.now();
  const upcoming = rows.filter((b: any) => +b.endsAt >= now && b.status !== 'cancelled' && b.status !== 'completed'), history = rows.filter((b: any) => !upcoming.includes(b));
  const Row = ({ b }: { b: any }) => (
    <div className="bk"><div><b>{lang === 'ar' ? b.serviceNameAr : b.serviceNameEn}</b><div className="muted">{fmtDateTime(b.startsAt, lang, cfg.tz)}</div></div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className={`tag ${tagClass(b.status)}`}>{t(`book.status.${b.status}`)}</span><a className="btn sm" href={`/bookings/${b.id}`}>{t('book.details')}</a></div></div>);
  return (
    <>
      <CustomerHeader current="bookings" />
      <main className="page">
        <h1>{t('book.my_title')}</h1>
        {!rows.length && <p className="muted">{t('book.none')}</p>}
        {upcoming.length > 0 && <><h2>{t('book.upcoming')}</h2>{upcoming.map((b: any) => <Row key={b.id} b={b} />)}</>}
        {history.length > 0 && <><h2 style={{ marginTop: 24 }}>{t('book.history')}</h2>{history.map((b: any) => <Row key={b.id} b={b} />)}</>}
        <a className="btn" style={{ maxWidth: 260 }} href="/sessions">{t('nav.sessions')}</a>
      </main>
    </>
  );
}
