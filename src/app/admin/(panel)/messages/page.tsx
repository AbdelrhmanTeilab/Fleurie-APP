import { requireStaff } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { TEMPLATES } from '@/lib/templates';
import { runRemindersAction, saveSiteUrlAction, saveTemplateAction } from '@/app/actions/ops';
import { ActionForm, Field, Submit } from '@/components/forms';

export default async function Messages() {
  await requireStaff('settings.manage'); const { lang, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const cronOk = (process.env.CRON_SECRET ?? '').length >= 16;
  return (
    <>
      <h1>{m('قوالب الرسائل والتذكيرات', 'Message templates & reminders')}</h1>
      <div className="card wide">
        <h3>{m('التذكيرات التلقائية', 'Automatic reminders')}</h3>
        <p className="muted">{m('تذكير قبل الموعد بـ 24 ساعة، وتذكير بالجلسة الدورية للعميلات اللاتي فعّلن التذكير (بعد المدة التي اختارتها كل عميلة من آخر جلسة). لا يتكرر أي تذكير مرتين.', 'A reminder 24 hours before an appointment, and a routine-session reminder for customers who opted in (after the number of days each chose since her last session). No reminder is ever sent twice.')}</p>
        <div className={`msg ${cronOk ? 'ok' : 'err'}`}>{cronOk ? m('التشغيل التلقائي مفعّل: اضبطي جدولة تستدعي /api/cron/reminders كل ساعة.', 'Automatic run is enabled: schedule a call to /api/cron/reminders every hour.') : m('التشغيل التلقائي غير مفعّل بعد (لم يُضبط CRON_SECRET). يمكنك التشغيل يدويًا بالزر أدناه.', 'Automatic run is not enabled yet (CRON_SECRET not set). You can run it by hand with the button below.')}</div>
        <ActionForm action={runRemindersAction}><Submit>{m('تشغيل التذكيرات الآن', 'Run reminders now')}</Submit></ActionForm>
      </div>
      <div className="card wide" style={{ marginTop: 16 }}>
        <h3>{m('رابط الموقع في الرسائل', 'Website link used in messages')}</h3>
        <ActionForm action={saveSiteUrlAction}><Field label={m('الرابط', 'Link')} name="url" dir="ltr" defaultValue={settings['site.url'] ?? ''} placeholder="https://fleurie.example.com" /><Submit>{m('حفظ', 'Save')}</Submit></ActionForm>
      </div>
      <h2 style={{ marginTop: 26 }}>{m('نصوص الرسائل', 'Message texts')}</h2>
      <p className="muted">{m('يمكنك استخدام: ', 'You can use: ')}<span dir="ltr">{'{name} {service} {when} {reason} {offer} {discount} {link} {brand}'}</span>. {m('النص بين [[ ]] يُحذف لو كان المتغير بداخله فارغًا. واتساب يتطلب قالبًا معتمدًا من ميتا لإرسال رسائل تلقائية، لذلك تبقى الرسائل في صندوق الرسائل للإرسال اليدوي حتى يتم ربطه.', 'Text inside [[ ]] is dropped when the variable inside it is empty. WhatsApp needs a Meta-approved template for automatic messages, so until that is linked, messages wait in the outbox for manual sending.')}</p>
      {TEMPLATES.map(t => (
        <details className="box" key={t.key}><summary>{m(t.titleAr, t.titleEn)}</summary>
          <ActionForm action={saveTemplateAction}><input type="hidden" name="key" value={t.key} />
            <div className="grid2">
              <div><label>{m('بالعربية', 'Arabic')}</label><textarea name="ar" rows={3} defaultValue={settings[`msg.${t.key}.ar`] || t.ar} /></div>
              <div><label>{m('بالإنجليزية', 'English')}</label><textarea name="en" rows={3} dir="ltr" defaultValue={settings[`msg.${t.key}.en`] || t.en} /></div>
            </div>
            <Submit>{m('حفظ', 'Save')}</Submit></ActionForm></details>))}
    </>
  );
}
