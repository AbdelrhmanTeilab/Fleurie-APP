import { getI18n } from '@/lib/i18n';
import { forgotAction } from '../actions/customer';
import { ActionForm, Field, Submit } from '@/components/forms';
import { Brand } from '@/components/Shell';

export default async function Forgot() {
  const { t } = await getI18n();
  return (
    <div className="center"><Brand />
      <div className="card"><h2>{t('auth.forgot_title')}</h2><p className="muted">{t('auth.forgot_sub')}</p>
        <ActionForm action={forgotAction}>
          <Field label={t('auth.login_id')} name="identifier" required dir="ltr" />
          <label>{t('auth.code_channel')}</label>
          <div className="seg">
            <label><input type="radio" name="channel" value="whatsapp" defaultChecked />{t('auth.whatsapp_opt')}</label>
            <label><input type="radio" name="channel" value="email" />{t('auth.email_opt')}</label>
          </div>
          <Submit>{t('auth.send_code')}</Submit>
        </ActionForm>
        <p className="muted" style={{ textAlign: 'center', marginTop: 14 }}><a href="/login">{t('common.back')}</a></p>
      </div>
    </div>
  );
}
