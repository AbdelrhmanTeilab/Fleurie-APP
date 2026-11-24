import { and, asc, eq } from 'drizzle-orm';
import { requireCustomer } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { bookingSettings } from '@/lib/availability';
import { loadOffers, priceFor } from '@/lib/pricing';
import { todayIn } from '@/lib/time';
import { CustomerHeader } from '@/components/CustomerHeader';

export default async function Sessions() {
  await requireCustomer(); const { t, lang, settings } = await getI18n(); const cfg = bookingSettings(settings);
  const db = await getDb();
  const cats = await db.select().from(s.serviceCategories).where(eq(s.serviceCategories.active, true)).orderBy(asc(s.serviceCategories.sort));
  const svcs = await db.select().from(s.services).where(eq(s.services.active, true)).orderBy(asc(s.services.sort), asc(s.services.id));
  const offers = await loadOffers(db, todayIn(cfg.tz));
  const L = (a: any, k: string) => a[k + (lang === 'ar' ? 'Ar' : 'En')] as string;
  return (
    <>
      <CustomerHeader current="sessions" />
      <main className="page">
        <h1>{t('book.sessions_title')}</h1><p className="muted">{t('book.sessions_sub')}</p>
        {cats.map((cat: any) => {
          const list = svcs.filter((x: any) => x.categoryId === cat.id); if (!list.length) return null;
          return (<section key={cat.id}><h2 style={{ marginTop: 26 }}>{L(cat, 'name')}</h2>
            <div className="cards">{list.map((sv: any) => { const p = priceFor(sv, offers); return (
              <article className="svc" key={sv.id}>
                {sv.image ? <img src={`/uploads/${sv.image}`} alt={L(sv, 'name')} /> : <div className="ph">✿</div>}
                <div className="body">
                  <h3 style={{ margin: 0 }}>{L(sv, 'name')}</h3>
                  <div className="muted">{sv.durationMin} {t('book.duration')}</div>
                  {L(sv, 'desc') && <div style={{ fontSize: '.92rem' }}>{L(sv, 'desc')}</div>}
                  <div className="price">{p.discount > 0 && <s>{p.listPrice}</s>}{p.price} {t('book.currency')} {p.offer && <span className="tag ok">{lang === 'ar' ? p.offer.nameAr : p.offer.nameEn}</span>}</div>
                  <a className="btn" href={`/book/${sv.id}`}>{t('book.book_now')}</a>
                </div>
              </article>); })}</div></section>);
        })}
      </main>
    </>
  );
}
