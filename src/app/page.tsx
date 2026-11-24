import { redirect } from 'next/navigation';
import { getCustomer } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { registerAction } from './actions/customer';
import { ActionForm, Field, Submit } from '@/components/forms';
import { LangSwitch } from '@/components/Shell';

export default async function Home() {
  if (await getCustomer()) redirect('/account');
  const { t, brand } = await getI18n();
  return (
    <div className="hero">
      <section className="hero-art">
        {brand.logo ? <img src={`/uploads/${brand.logo}`} alt={brand.name} /> : <div className="wordmark">{brand.name}</div>}
        <div className="slogan">{brand.slogan}</div>
        <p>{t('auth.register_sub')}</p>
      </section>
      <section className="hero-form">
        <div className="lang-float"><LangSwitch /></div>
        <div className="card">
          <h2>{t('auth.register_title')}</h2>
          <ActionForm action={registerAction}>
            <Field label={t('auth.name')} name="name" required autoComplete="name" />
            <Field label={t('auth.whatsapp')} name="whatsapp" type="tel" required placeholder="01XXXXXXXXX" dir="ltr" autoComplete="tel" />
            <Field label={t('auth.email')} name="email" type="email" required dir="ltr" autoComplete="email" />
            <Field label={t('auth.password')} name="password" type="password" required minLength={8} autoComplete="new-password" hint={t('auth.password_hint')} />
            <Field label={t('auth.first_session')} name="firstSession" type="date" hint={t('auth.first_session_hint')} />
            <label>{t('auth.code_channel')}</label>
            <div className="seg">
              <label><input type="radio" name="channel" value="whatsapp" defaultChecked />{t('auth.whatsapp_opt')}</label>
              <label><input type="radio" name="channel" value="email" />{t('auth.email_opt')}</label>
            </div>
            <div className="check"><input type="checkbox" id="reminders" name="reminders" /><label htmlFor="reminders" style={{ margin: 0 }}>{t('auth.reminders')}</label></div>
            <Submit>{t('auth.submit_register')}</Submit>
          </ActionForm>
          <p className="muted" style={{ textAlign: 'center', marginTop: 16 }}>{t('auth.have_account')} <a href="/login">{t('auth.submit_login')}</a></p>
        </div>
      </section>
    </div>
  );
}
