import { ActionForm, Field, Submit } from './forms';
import { resetStaffPasswordAction, saveStaffAction } from '@/app/actions/staff';

const DAYS: [string, string, string][] = [['sat', 'السبت', 'Sat'], ['sun', 'الأحد', 'Sun'], ['mon', 'الاثنين', 'Mon'], ['tue', 'الثلاثاء', 'Tue'], ['wed', 'الأربعاء', 'Wed'], ['thu', 'الخميس', 'Thu'], ['fri', 'الجمعة', 'Fri']];

export function StaffForm({ lang, staff, roles, cats, links }: { lang: 'ar' | 'en'; staff?: any; roles: any[]; cats: any[]; links: any[] }) {
  const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const wh = staff?.workingHours ?? {};
  return (
    <>
      <ActionForm action={saveStaffAction}>
        {staff && <input type="hidden" name="id" value={staff.id} />}
        <div className="grid2">
          <Field label={m('الاسم بالعربية', 'Name (Arabic)')} name="nameAr" defaultValue={staff?.nameAr} required />
          <Field label={m('الاسم بالإنجليزية', 'Name (English)')} name="nameEn" defaultValue={staff?.nameEn} required dir="ltr" />
          <Field label={m('البريد (للدخول)', 'Email (sign-in)')} name="email" type="email" defaultValue={staff?.email} required dir="ltr" />
          <Field label={m('الهاتف', 'Phone')} name="phone" defaultValue={staff?.phone} dir="ltr" />
          <div><label>{m('الدور', 'Role')}</label><select name="roleId" defaultValue={staff?.roleId}>{roles.map(r => <option key={r.id} value={r.id}>{lang === 'ar' ? r.nameAr : r.nameEn}</option>)}</select></div>
          <div className="check" style={{ alignSelf: 'end' }}><input type="checkbox" name="active" id={`a${staff?.id ?? 'n'}`} defaultChecked={staff ? staff.active : true} /><label htmlFor={`a${staff?.id ?? 'n'}`} style={{ margin: 0 }}>{m('حساب نشط', 'Active account')}</label></div>
        </div>
        <label>{m('الأقسام التي تؤديها (وتحديد "دعم" إن كانت تساند فقط عند انشغال المتخصصة الأساسية)', 'Categories performed (tick "support" if she only helps when the main specialist is busy)')}</label>
        {cats.map(c => { const l = links.find(x => x.staffId === staff?.id && x.categoryId === c.id);
          return (<div className="check" key={c.id} style={{ gap: 18 }}>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name={`cat_${c.id}`} defaultChecked={!!l} /> {lang === 'ar' ? c.nameAr : c.nameEn}</span>
            <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><input type="checkbox" name={`support_${c.id}`} defaultChecked={l?.priority === 2} /> {m('دعم', 'support')}</span></div>); })}
        <label>{m('ساعات العمل', 'Working hours')}</label>
        {DAYS.map(([k, ar, en]) => { const d = wh[k]; return (
          <div className="dayrow" key={k}><span>{lang === 'ar' ? ar : en}</span>
            <input type="time" name={`from_${k}`} defaultValue={d?.from ?? '11:00'} /><input type="time" name={`to_${k}`} defaultValue={d?.to ?? '19:00'} />
            <span className="check"><input type="checkbox" name={`off_${k}`} defaultChecked={staff ? d === null : k === 'fri'} />{m('إجازة', 'Off')}</span></div>); })}
        <Submit>{staff ? m('حفظ التعديلات', 'Save changes') : m('إضافة موظف', 'Add staff member')}</Submit>
      </ActionForm>
      {staff && <ActionForm action={resetStaffPasswordAction}><input type="hidden" name="id" value={staff.id} /><Submit className="btn ghost">{m('إعادة تعيين كلمة المرور', 'Reset password')}</Submit></ActionForm>}
    </>
  );
}
