import { redirect } from 'next/navigation';
import { getCustomer } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { loginAction } from '../actions/customer';
import { ActionForm, Field, Submit } from '@/components/forms';
import { Brand, LangSwitch } from '@/components/Shell';

export default async function Login({ searchParams }: { searchParams: Promise<{ reset?: string }> }) {
  if (await getCustomer()) redirect('/account');
  const { t, lang } = await getI18n(); const q = await searchParams;
  return (
    <div className="center"><LangSwitch /><Brand />
      <div className="card">
        <h2>{t('auth.login_title')}</h2>
        {q.reset && <div className="msg ok">{lang === 'ar' ? 'تم تغيير كلمة المرور. سجّل الدخول.' : 'Password changed. Please sign in.'}</div>}
        <ActionForm action={loginAction}>
          <Field label={t('auth.login_id')} name="identifier" required dir="ltr" autoComplete="username" />
          <Field label={t('auth.password')} name="password" type="password" required autoComplete="current-password" />
          <Submit>{t('auth.submit_login')}</Submit>
        </ActionForm>
        <p className="muted" style={{ textAlign: 'center', marginTop: 14 }}><a href="/forgot">{t('auth.forgot')}</a></p>
        <p className="muted" style={{ textAlign: 'center' }}>{t('auth.no_account')} <a href="/">{t('nav.register')}</a></p>
      </div>
    </div>
  );
}
