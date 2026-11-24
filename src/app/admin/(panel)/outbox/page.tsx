import { desc } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';
import { markNotificationSentAction } from '@/app/actions/staff';

export default async function Outbox() {
  await requireStaff('customers.manage'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const db = await getDb(); const rows = await db.select().from(s.notifications).orderBy(desc(s.notifications.createdAt)).limit(100);
  const live = !!(process.env.WHATSAPP_TOKEN || process.env.RESEND_API_KEY);
  return (
    <>
      <h1>{m('الرسائل وأكواد التحقق', 'Messages & verification codes')}</h1>
      <div className={`msg ${live ? 'ok' : 'err'}`}>{live ? m('تم ضبط مزوّد إرسال واحد على الأقل.', 'At least one delivery provider is configured.') : m('لم يتم ضبط واتساب أو البريد بعد، فالرسائل تنتظر هنا ويتم إرسالها يدويًا بزر واحد.', 'WhatsApp and email are not configured yet, so messages wait here and you send them by hand with one tap.')}</div>
      <table style={{ marginTop: 14 }}><thead><tr><th>{m('الوقت', 'Time')}</th><th>{m('القناة', 'Channel')}</th><th>{m('إلى', 'To')}</th><th>{m('الرسالة', 'Message')}</th><th>{m('الحالة', 'Status')}</th><th /></tr></thead>
        <tbody>{rows.map((r: any) => {
          const link = r.channel === 'whatsapp' ? `https://wa.me/${r.toAddress}?text=${encodeURIComponent(r.body)}` : `mailto:${r.toAddress}?subject=${encodeURIComponent('Fleurie')}&body=${encodeURIComponent(r.body)}`;
          return (<tr key={r.id}><td className="muted">{new Date(r.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</td><td>{r.channel}</td><td dir="ltr">{r.toAddress}</td><td style={{ whiteSpace: 'pre-wrap' }}>{r.body}</td>
            <td><span className={`tag ${r.status === 'sent' ? 'ok' : r.status === 'failed' ? 'bad' : 'warn'}`}>{r.status}</span></td>
            <td>{r.status === 'manual' && <><a className="btn sm" target="_blank" href={link}>{m('فتح للإرسال', 'Open to send')}</a>
              <form action={markNotificationSentAction} style={{ marginTop: 6 }}><input type="hidden" name="id" value={r.id} /><button className="btn sm ghost">{m('تم الإرسال', 'Mark sent')}</button></form></>}</td></tr>);
        })}</tbody></table>
    </>
  );
}
