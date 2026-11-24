import { getI18n } from '@/lib/i18n';
import { logoutAction } from '@/app/actions/customer';
import { Brand, LangSwitch } from './Shell';

export async function CustomerHeader({ current }: { current: 'sessions' | 'bookings' | 'offers' | 'profile' }) {
  const { t } = await getI18n();
  const link = (k: typeof current, href: string, label: string) => <a key={k} className={`pill${current === k ? ' on' : ''}`} href={href}>{label}</a>;
  return (
    <header className="topbar">
      <Brand />
      <nav>
        {link('sessions', '/sessions', t('nav.sessions'))}{link('offers', '/offers', t('nav.offers'))}{link('bookings', '/bookings', t('nav.bookings'))}{link('profile', '/account', t('nav.profile'))}
        <LangSwitch />
        <form action={logoutAction}><button className="pill">{t('nav.logout')}</button></form>
      </nav>
    </header>
  );
}
