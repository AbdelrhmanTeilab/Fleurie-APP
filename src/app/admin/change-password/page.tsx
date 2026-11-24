import { requireStaff } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { changePasswordAction } from '@/app/actions/staff';
import { ActionForm, Field, Submit } from '@/components/forms';
import { Brand } from '@/components/Shell';

export default async function ChangePassword() {
  const u = await requireStaff(undefined, { allowMustChange: true });
  const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  return (
    <div className="center"><Brand />
      <div className="card"><h2>{m('تغيير كلمة المرور', 'Change password')}</h2>
        {u.mustChangePassword && <p className="muted">{m('يجب تغيير كلمة المرور المؤقتة قبل المتابعة.', 'You must replace the temporary password before continuing.')}</p>}
        <ActionForm action={changePasswordAction}>
          <Field label={m('كلمة المرور الحالية', 'Current password')} name="current" type="password" required autoComplete="current-password" />
          <Field label={m('كلمة المرور الجديدة', 'New password')} name="next" type="password" required minLength={8} autoComplete="new-password" hint={m('8 أحرف على الأقل مع حروف وأرقام', 'At least 8 characters with letters and numbers')} />
          <Submit>{m('حفظ', 'Save')}</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
