import { requireCustomer } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { updateProfileAction } from '../actions/customer';
import { ActionForm, Field, Submit } from '@/components/forms';
import { CustomerHeader } from '@/components/CustomerHeader';

export default async function Account() {
  const c = await requireCustomer(); const { t, lang } = await getI18n();
  return (
    <>
      <CustomerHeader current="profile" />
      <main className="page">
        <h1>{t('auth.welcome')}، {c.name}</h1>
        <div className="card wide">
          <h2>{t('profile.title')}</h2>
          <ActionForm action={updateProfileAction}>
            <div className="grid2">
              <Field label={t('auth.name')} name="name" defaultValue={c.name} required />
              <Field label={t('auth.first_session')} name="firstSession" type="date" defaultValue={c.firstSessionDate ?? ''} hint={t('auth.first_session_hint')} />
              <Field label={t('auth.whatsapp')} name="wa" defaultValue={c.whatsapp} disabled dir="ltr" />
              <Field label={t('auth.email')} name="em" defaultValue={c.email} disabled dir="ltr" />
            </div>
            <h3 style={{ marginTop: 22 }}>{t('profile.reminder_title')}</h3>
            <div className="check"><input type="checkbox" id="reminders" name="reminders" defaultChecked={c.reminderEnabled} /><label htmlFor="reminders" style={{ margin: 0 }}>{t('auth.reminders')}</label></div>
            <div className="grid2">
              <Field label={t('profile.reminder_every')} name="reminderDay" type="number" min={7} max={90} defaultValue={c.reminderDay} />
              <div><label>{t('auth.code_channel')}</label><select name="channel" defaultValue={c.reminderChannel}><option value="whatsapp">{t('auth.whatsapp_opt')}</option><option value="email">{t('auth.email_opt')}</option></select></div>
            </div>
            <Submit>{t('profile.save')}</Submit>
          </ActionForm>
        </div>
      </main>
    </>
  );
}
