import { asc } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { deleteOfferAction, saveOfferAction } from '@/app/actions/admin';
import { announceOfferAction } from '@/app/actions/ops';
import { ActionForm, Field, Submit } from '@/components/forms';

function OfferForm({ o, svcs, linked, m }: { o?: any; svcs: any[]; linked: number[]; m: (a: string, e: string) => string }) {
  return (
    <ActionForm action={saveOfferAction}>
      {o && <input type="hidden" name="id" value={o.id} />}
      <div className="grid2">
        <Field label={m('اسم العرض بالعربية', 'Offer name (Arabic)')} name="nameAr" defaultValue={o?.nameAr} required />
        <Field label={m('اسم العرض بالإنجليزية', 'Offer name (English)')} name="nameEn" defaultValue={o?.nameEn} required dir="ltr" />
        <div><label>{m('الوصف بالعربية', 'Description (Arabic)')}</label><textarea name="descAr" rows={2} defaultValue={o?.descAr} /></div>
        <div><label>{m('الوصف بالإنجليزية', 'Description (English)')}</label><textarea name="descEn" rows={2} defaultValue={o?.descEn} dir="ltr" /></div>
        <Field label={m('نسبة الخصم %', 'Percent off')} name="percent" type="number" min={0} max={100} defaultValue={o?.percent ?? 0} />
        <Field label={m('أو مبلغ خصم (ج.م)', 'Or amount off (EGP)')} name="amountOff" type="number" min={0} defaultValue={o?.amountOff ?? 0} />
        <Field label={m('يبدأ في', 'Starts')} name="startDate" type="date" defaultValue={o?.startDate ?? ''} />
        <Field label={m('ينتهي في', 'Ends')} name="endDate" type="date" defaultValue={o?.endDate ?? ''} />
      </div>
      <label>{m('الجلسات المشمولة (بدون اختيار = كل الجلسات)', 'Applies to (none selected = all sessions)')}</label>
      <div className="perm">{svcs.map(sv => <div className="check" key={sv.id}><input type="checkbox" name="serviceIds" value={sv.id} id={`o${o?.id ?? 'n'}s${sv.id}`} defaultChecked={linked.includes(sv.id)} /><label style={{ margin: 0 }} htmlFor={`o${o?.id ?? 'n'}s${sv.id}`}>{m(sv.nameAr, sv.nameEn)}</label></div>)}</div>
      <div className="check"><input type="checkbox" name="active" id={`oa${o?.id ?? 'n'}`} defaultChecked={o ? o.active : true} /><label style={{ margin: 0 }} htmlFor={`oa${o?.id ?? 'n'}`}>{m('مفعّل', 'Active')}</label></div>
      <Submit>{m('حفظ', 'Save')}</Submit>
    </ActionForm>
  );
}

export default async function Offers() {
  await requireStaff('services.manage'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const db = await getDb();
  const offers = await db.select().from(s.offers).orderBy(asc(s.offers.id)), svcs = await db.select().from(s.services).orderBy(asc(s.services.id)), links = await db.select().from(s.offerServices);
  return (
    <>
      <h1>{m('العروض والخصومات', 'Offers & discounts')}</h1>
      <p className="muted">{m('يُطبَّق أفضل خصم تلقائيًا عند الحجز، والعربون يُحسب على السعر بعد الخصم.', 'The best discount is applied automatically at booking, and the deposit is calculated on the discounted price.')}</p>
      <details className="box" open={!offers.length}><summary>+ {m('إضافة عرض', 'Add an offer')}</summary><OfferForm svcs={svcs} linked={[]} m={m} /></details>
      {offers.map((o: any) => (
        <details className="box" key={o.id}><summary>{m(o.nameAr, o.nameEn)} · {o.percent ? `${o.percent}%` : `${o.amountOff} ${m('ج.م', 'EGP')}`} {!o.active && <span className="tag bad">{m('متوقف', 'Off')}</span>}</summary>
          <OfferForm o={o} svcs={svcs} linked={links.filter((l: any) => l.offerId === o.id).map((l: any) => l.serviceId)} m={m} />
          {o.active && <div style={{ marginTop: 12 }}><ActionForm action={announceOfferAction}><input type="hidden" name="id" value={o.id} /><Submit className="btn ghost sm">{m('إعلان العرض للعميلات المشتركات في الرسائل', 'Announce to customers who opted in to messages')}</Submit></ActionForm></div>}
          <form action={deleteOfferAction}><input type="hidden" name="id" value={o.id} /><Submit className="btn danger sm">{m('حذف العرض', 'Delete offer')}</Submit></form></details>))}
    </>
  );
}
