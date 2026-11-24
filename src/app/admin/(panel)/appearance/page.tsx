import { requireStaff } from '@/lib/auth';
import { getI18n, getOverrides } from '@/lib/i18n';
import { DEFAULT_LABELS } from '@/lib/labels';
import { resetThemeAction, saveBrandAction, saveLabelsAction } from '@/app/actions/staff';
import { ActionForm, Field, Submit } from '@/components/forms';
import { LivePreview } from '@/components/LivePreview';

export default async function Appearance() {
  await requireStaff('settings.manage'); const { lang, settings: S } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const over = await getOverrides();
  const groups: [string, string, string][] = [['nav.', 'القوائم', 'Menus'], ['auth.', 'التسجيل وتسجيل الدخول', 'Registration & sign-in'], ['profile.', 'حساب العميل', 'Customer account'], ['book.', 'الحجز والجلسات والعروض', 'Booking, sessions & offers'], ['common.', 'عام', 'General'], ['lang.', 'اللغة', 'Language']];
  const colors = [['theme.primary', 'اللون الرئيسي', 'Primary'], ['theme.accent', 'اللون المميز', 'Accent'], ['theme.bg', 'الخلفية', 'Background'], ['theme.surface', 'البطاقات', 'Cards'], ['theme.text', 'النص', 'Text']];
  return (
    <>
      <h1>{m('المظهر والمحتوى', 'Appearance & content')}</h1>
      <p className="muted">{m('كل ما هنا يظهر فورًا للعملاء ولا يحتاج أي تعديل برمجي.', 'Everything here changes the customer site immediately. No code changes needed.')}</p>
      <LivePreview lang={lang} nameAr={S['brand.name_ar']} nameEn={S['brand.name_en']} sloganAr={S['brand.slogan_ar']} sloganEn={S['brand.slogan_en']}>
        <ActionForm action={saveBrandAction} className="card wide">
          <h2>{m('هوية المركز', 'Brand')}</h2>
          <div className="grid2">
            <Field label={m('اسم المركز (عربي)', 'Center name (Arabic)')} name="brand.name_ar" defaultValue={S['brand.name_ar']} required />
            <Field label={m('اسم المركز (إنجليزي)', 'Center name (English)')} name="brand.name_en" defaultValue={S['brand.name_en']} required dir="ltr" />
            <Field label={m('العبارة تحت الاسم (عربي)', 'Slogan (Arabic)')} name="brand.slogan_ar" defaultValue={S['brand.slogan_ar']} />
            <Field label={m('العبارة تحت الاسم (إنجليزي)', 'Slogan (English)')} name="brand.slogan_en" defaultValue={S['brand.slogan_en']} dir="ltr" />
            <Field label={m('هاتف المركز', 'Center phone')} name="brand.phone" defaultValue={S['brand.phone']} dir="ltr" />
            <span />
            <Field label={m('العنوان (عربي)', 'Address (Arabic)')} name="brand.address_ar" defaultValue={S['brand.address_ar']} />
            <Field label={m('العنوان (إنجليزي)', 'Address (English)')} name="brand.address_en" defaultValue={S['brand.address_en']} dir="ltr" />
          </div>
          <label>{m('الشعار (PNG أو JPG أو WEBP، حتى 3 ميجابايت)', 'Logo (PNG, JPG or WEBP, up to 3 MB)')}</label>
          {S['brand.logo'] && <p><img className="logo-prev" src={`/uploads/${S['brand.logo']}`} alt="" /></p>}
          <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" />
          {S['brand.logo'] && <div className="check"><input type="checkbox" name="removeLogo" id="rl" /><label htmlFor="rl" style={{ margin: 0 }}>{m('إزالة الشعار والعودة للاسم المكتوب', 'Remove logo and use the text name')}</label></div>}
          <h2 style={{ marginTop: 22 }}>{m('الألوان', 'Colors')}</h2>
          <div className="grid3">
            {colors.map(([k, ar, en]) => <div key={k}><label>{m(ar, en)}</label><input type="color" name={k} defaultValue={S[k]} /></div>)}
          </div>
          <h2 style={{ marginTop: 22 }}>{m('العربون والدفع', 'Deposit & payment')}</h2>
          <Field label={m('نسبة العربون الافتراضية %', 'Default deposit %')} name="booking.deposit_percent_default" type="number" min={0} max={100} defaultValue={S['booking.deposit_percent_default']} hint={m('يمكن تغييرها لكل جلسة لاحقًا', 'Can be overridden per session later')} />
          <label>{m('تعليمات تحويل العربون (عربي)', 'Deposit instructions (Arabic)')}</label><textarea name="payment.instructions_ar" rows={2} defaultValue={S['payment.instructions_ar']} />
          <label>{m('تعليمات تحويل العربون (إنجليزي)', 'Deposit instructions (English)')}</label><textarea name="payment.instructions_en" rows={2} defaultValue={S['payment.instructions_en']} dir="ltr" />
          <Submit>{m('حفظ', 'Save')}</Submit>
        </ActionForm>
      </LivePreview>
      <form action={resetThemeAction}><button className="btn ghost sm" style={{ marginTop: 10 }}>{m('استعادة الألوان الافتراضية', 'Restore default colors')}</button></form>

      <h2 style={{ marginTop: 30 }}>{m('أسماء الأقسام والنصوص', 'Section names & texts')}</h2>
      <p className="muted">{m('غيّر أي نص يظهر للعميل. اترك الخانة فارغة للعودة للنص الأصلي. أسماء الجلسات والعروض وصورها تُدار من قسمها في المرحلة القادمة.', 'Change any text customers see. Leave a box empty to use the original. Session names, offers and images are managed in their own sections in the next phase.')}</p>
      <ActionForm action={saveLabelsAction}>
        {groups.map(([prefix, ar, en]) => (
          <details className="box" key={prefix} open={prefix === 'nav.'}><summary>{m(ar, en)}</summary>
            {Object.entries(DEFAULT_LABELS).filter(([k]) => k.startsWith(prefix)).map(([k, d]) => (
              <div className="grid2" key={k}>
                <div><label>{k} · AR</label><input type="text" name={'ar:' + k} defaultValue={over['ar:' + k] ?? ''} placeholder={d.ar} /></div>
                <div><label>{k} · EN</label><input type="text" name={'en:' + k} defaultValue={over['en:' + k] ?? ''} placeholder={d.en} dir="ltr" /></div>
              </div>))}
          </details>))}
        <Submit>{m('حفظ النصوص', 'Save texts')}</Submit>
      </ActionForm>
    </>
  );
}
