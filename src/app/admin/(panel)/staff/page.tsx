import { asc, eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { PERMISSIONS, ALL_PERMISSIONS } from '@/lib/permissions';
import { saveRoleAction } from '@/app/actions/staff';
import { ActionForm, Submit } from '@/components/forms';
import { StaffForm } from '@/components/StaffForm';

export default async function StaffPage() {
  await requireStaff('staff.manage'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const db = await getDb();
  const [staff, roles, cats, links, rp] = await Promise.all([
    db.select().from(s.staff).orderBy(asc(s.staff.id)), db.select().from(s.roles).orderBy(asc(s.roles.id)),
    db.select().from(s.serviceCategories).orderBy(asc(s.serviceCategories.sort)), db.select().from(s.staffCategories), db.select().from(s.rolePermissions),
  ]);
  const roleName = (id: number) => { const r = roles.find((x: any) => x.id === id); return lang === 'ar' ? r.nameAr : r.nameEn; };
  return (
    <>
      <h1>{m('الموظفون والصلاحيات', 'Staff & roles')}</h1>
      <p className="muted">{m('الجلسات تُسند تلقائيًا لمن تؤدي القسم المطلوب. صاحبة الأولوية أولًا ثم من تدعم.', 'Sessions are auto-assigned to whoever performs the category. First-choice staff first, then support staff.')}</p>
      {staff.map((st: any) => (
        <details className="box" key={st.id}>
          <summary>{lang === 'ar' ? st.nameAr : st.nameEn} <span className="tag">{roleName(st.roleId)}</span> {!st.active && <span className="tag bad">{m('معطّل', 'Inactive')}</span>}
            {links.filter((l: any) => l.staffId === st.id).map((l: any) => { const c = cats.find((x: any) => x.id === l.categoryId); return <span key={l.categoryId} className="tag ok" style={{ marginInlineStart: 6 }}>{lang === 'ar' ? c.nameAr : c.nameEn}{l.priority === 2 ? ` (${m('دعم', 'support')})` : ''}</span>; })}</summary>
          <StaffForm lang={lang} staff={st} roles={roles} cats={cats} links={links} />
        </details>))}
      <details className="box"><summary>+ {m('إضافة موظف جديد', 'Add a new staff member')}</summary><StaffForm lang={lang} roles={roles} cats={cats} links={links} /></details>
      <h2 style={{ marginTop: 28 }}>{m('صلاحيات الأدوار', 'Role permissions')}</h2>
      {roles.map((r: any) => (
        <details className="box" key={r.id}>
          <summary>{lang === 'ar' ? r.nameAr : r.nameEn} {r.system && <span className="tag">{m('كل الصلاحيات (ثابت)', 'All permissions (fixed)')}</span>}</summary>
          <ActionForm action={saveRoleAction}><input type="hidden" name="id" value={r.id} />
            <div className="perm">{ALL_PERMISSIONS.map(p => (
              <div className="check" key={p}><input type="checkbox" name={p} id={`${r.id}${p}`} disabled={r.system} defaultChecked={r.system || rp.some((x: any) => x.roleId === r.id && x.permission === p)} /><label htmlFor={`${r.id}${p}`} style={{ margin: 0 }}>{PERMISSIONS[p][lang]}</label></div>))}</div>
            {!r.system && <Submit>{m('حفظ الصلاحيات', 'Save permissions')}</Submit>}
          </ActionForm>
        </details>))}
    </>
  );
}
