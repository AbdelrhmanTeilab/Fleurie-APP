import { setLanguage } from '@/app/actions/customer';
import { getI18n } from '@/lib/i18n';

export async function Brand({ size }: { size?: 'big' }) {
  const { brand } = await getI18n();
  return (
    <a className="brand" href="/">
      {brand.logo ? <img src={`/uploads/${brand.logo}`} alt={brand.name} /> : <span className="wordmark" style={size ? { fontSize: '3.4rem' } : undefined}>{brand.name}</span>}
      {brand.slogan && <span className="slogan">{brand.slogan}</span>}
    </a>
  );
}
export async function LangSwitch() {
  const { lang, t } = await getI18n();
  return (<form action={async () => { 'use server'; await setLanguage(lang === 'ar' ? 'en' : 'ar'); }}><button className="pill">{t('lang.switch')}</button></form>);
}
