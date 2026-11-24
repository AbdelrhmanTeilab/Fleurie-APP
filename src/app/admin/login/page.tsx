import { redirect } from 'next/navigation';
import { getStaff } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { staffLoginAction } from '@/app/actions/staff';
import { ActionForm, Field, Submit } from '@/components/forms';
import { Brand, LangSwitch } from '@/components/Shell';

export default async function AdminLogin() {
  if (await getStaff()) redirect('/admin');
  const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  return (
    <div className="center"><LangSwitch /><Brand />
      <div className="card"><h2>{m('دخول فريق العمل', 'Staff sign-in')}</h2>
        <ActionForm action={staffLoginAction}>
          <Field label={m('البريد الإلكتروني', 'Email')} name="email" type="email" required dir="ltr" autoComplete="username" />
          <Field label={m('كلمة المرور', 'Password')} name="password" type="password" required autoComplete="current-password" />
          <Submit>{m('دخول', 'Sign in')}</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
