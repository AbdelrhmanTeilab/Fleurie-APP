import { redirect } from 'next/navigation';
import { getPending } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { resetAction } from '../actions/customer';
import { ActionForm, Field, Submit } from '@/components/forms';
import { Brand } from '@/components/Shell';

export default async function Reset() {
  const p = await getPending(); if (!p || p.purpose !== 'reset') redirect('/forgot');
  const { t } = await getI18n();
  return (
    <div className="center"><Brand />
      <div className="card"><h2>{t('auth.reset_title')}</h2><p className="muted">{t('auth.verify_sub')}</p>
        <ActionForm action={resetAction}>
          <Field label={t('auth.code')} name="code" required inputMode="numeric" maxLength={6} dir="ltr" autoComplete="one-time-code" />
          <Field label={t('auth.password')} name="password" type="password" required minLength={8} autoComplete="new-password" hint={t('auth.password_hint')} />
          <Submit>{t('auth.reset_submit')}</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
