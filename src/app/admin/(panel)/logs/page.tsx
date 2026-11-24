import { desc } from 'drizzle-orm';
import { requireStaff } from '@/lib/auth';
import { getDb, schema as s } from '@/db';
import { getI18n } from '@/lib/i18n';

export default async function Logs() {
  await requireStaff('logs.view'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const db = await getDb(); const rows = await db.select().from(s.activityLogs).orderBy(desc(s.activityLogs.createdAt)).limit(300);
  return (
    <>
      <h1>{m('سجل النشاط', 'Activity log')}</h1>
      <table><thead><tr><th>{m('الوقت', 'Time')}</th><th>{m('المنفّذ', 'Actor')}</th><th>{m('الإجراء', 'Action')}</th><th>{m('العنصر', 'Entity')}</th></tr></thead>
        <tbody>{rows.map((r: any) => <tr key={r.id}><td className="muted">{new Date(r.createdAt).toLocaleString(lang === 'ar' ? 'ar-EG' : 'en-GB')}</td><td>{r.actorName || r.actorKind}{r.actorId ? ` #${r.actorId}` : ''}</td><td dir="ltr">{r.action}</td><td dir="ltr">{r.entity} {r.entityId}</td></tr>)}</tbody></table>
    </>
  );
}
