import { asc, eq } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { saveServiceAction } from '@/app/actions/admin';
import { ActionForm, Field, Submit } from '@/components/forms';

function ServiceForm({ sv, cats, m, defaultDep }: { sv?: any; cats: any[]; m: (a: string, e: string) => string; defaultDep: string }) {
  return (
    <ActionForm action={saveServiceAction}>
      {sv && <input type="hidden" name="id" value={sv.id} />}
      <div className="grid2">
        <Field label={m('الاسم بالعربية', 'Name (Arabic)')} name="nameAr" defaultValue={sv?.nameAr} required />
        <Field label={m('الاسم بالإنجليزية', 'Name (English)')} name="nameEn" defaultValue={sv?.nameEn} required dir="ltr" />
        <div><label>{m('الوصف بالعربية', 'Description (Arabic)')}</label><textarea name="descAr" rows={2} defaultValue={sv?.descAr} /></div>
        <div><label>{m('الوصف بالإنجليزية', 'Description (English)')}</label><textarea name="descEn" rows={2} defaultValue={sv?.descEn} dir="ltr" /></div>
      </div>
      <div className="grid3">
        <div><label>{m('القسم', 'Category')}</label><select name="categoryId" defaultValue={sv?.categoryId}>{cats.map(c => <option key={c.id} value={c.id}>{m(c.nameAr, c.nameEn)}</option>)}</select></div>
        <Field label={m('السعر (ج.م)', 'Price (EGP)')} name="price" type="number" min={0} defaultValue={sv?.price ?? ''} required />
        <Field label={m('المدة (دقيقة)', 'Duration (min)')} name="durationMin" type="number" min={10} max={600} step={5} defaultValue={sv?.durationMin ?? 60} required />
        <Field label={m('نسبة العربون %', 'Deposit %')} name="depositPercent" type="number" min={0} max={100} defaultValue={sv?.depositPercent ?? ''} hint={m(`اتركيه فارغًا لاستخدام الافتراضي (${defaultDep}%)`, `Leave empty to use the default (${defaultDep}%)`)} />
        <Field label={m('الترتيب', 'Order')} name="sort" type="number" defaultValue={sv?.sort ?? 0} />
        <div><label>{m('الصورة', 'Image')}</label><input type="file" name="image" accept="image/png,image/jpeg,image/webp" /></div>
      </div>
      {sv?.image && <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}><img className="logo-prev" src={`/uploads/${sv.image}`} alt="" /><div className="check"><input type="checkbox" id={`rm${sv.id}`} name="removeImage" /><label style={{ margin: 0 }} htmlFor={`rm${sv.id}`}>{m('حذف الصورة', 'Remove image')}</label></div></div>}
      <div className="check"><input type="checkbox" id={`a${sv?.id ?? 'n'}`} name="active" defaultChecked={sv ? sv.active : true} /><label style={{ margin: 0 }} htmlFor={`a${sv?.id ?? 'n'}`}>{m('ظاهرة للعملاء', 'Visible to customers')}</label></div>
      <Submit>{m('حفظ', 'Save')}</Submit>
    </ActionForm>
  );
}

export default async function Services() {
  await requireStaff('services.manage'); const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const db = await getDb();
  const cats = await db.select().from(s.serviceCategories).where(eq(s.serviceCategories.active, true)).orderBy(asc(s.serviceCategories.sort));
  const svcs = await db.select().from(s.services).orderBy(asc(s.services.categoryId), asc(s.services.sort), asc(s.services.id));
  const dd = settings['booking.deposit_percent_default'];
  return (
    <>
      <h1>{m('الجلسات والخدمات', 'Sessions & services')}</h1>
      <details className="box" open={!svcs.length}><summary>+ {m('إضافة جلسة جديدة', 'Add a new session')}</summary><ServiceForm cats={cats} m={m} defaultDep={dd} /></details>
      {svcs.map((sv: any) => (
        <details className="box" key={sv.id}><summary>{m(sv.nameAr, sv.nameEn)} · {sv.price} {m('ج.م', 'EGP')} · {sv.durationMin} {m('د', 'min')} {!sv.active && <span className="tag bad">{m('مخفية', 'Hidden')}</span>}</summary><ServiceForm sv={sv} cats={cats} m={m} defaultDep={dd} /></details>))}
    </>
  );
}
