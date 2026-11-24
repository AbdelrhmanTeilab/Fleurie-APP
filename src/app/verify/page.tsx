import { redirect } from 'next/navigation';
import { getPending } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { resendAction, verifyAction } from '../actions/customer';
import { ActionForm, Field, Submit } from '@/components/forms';
import { Brand } from '@/components/Shell';

export default async function Verify() {
  const p = await getPending(); if (!p || p.purpose !== 'verify') redirect('/');
  const { t } = await getI18n();
  return (
    <div className="center"><Brand />
      <div className="card">
        <h2>{t('auth.verify_title')}</h2><p className="muted">{t('auth.verify_sub')}</p>
        <ActionForm action={verifyAction}>
          <Field label={t('auth.code')} name="code" required inputMode="numeric" maxLength={6} pattern="\d{6}" autoComplete="one-time-code" dir="ltr" style={{ letterSpacing: '.4em', textAlign: 'center', fontSize: '1.4rem' }} />
          <Submit>{t('auth.verify')}</Submit>
        </ActionForm>
        <ActionForm action={resendAction}><Submit className="btn ghost">{t('auth.resend')}</Submit></ActionForm>
      </div>
    </div>
  );
}
