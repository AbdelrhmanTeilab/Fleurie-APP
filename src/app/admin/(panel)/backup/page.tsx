import { requireStaff } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';

export default async function Backup() {
  await requireStaff('staff.manage'); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  return (
    <>
      <h1>{m('النسخ الاحتياطي', 'Backup')}</h1>
      <div className="card wide">
        <p>{m('نسخة كاملة من كل البيانات: العملاء والحجوزات والمدفوعات والحسابات والمخزون والإعدادات، مع صور الإيصالات والصور المرفوعة.', 'A full copy of all data: customers, bookings, payments, finance, inventory and settings, plus payment proofs and uploaded images.')}</p>
        <p className="muted">{m('الملف يحتوي على بيانات حساسة. احفظيه في مكان آمن (ليس في واتساب أو بريد عادي). يُنصح بتنزيل نسخة أسبوعيًا على الأقل.', 'The file contains sensitive data. Keep it somewhere safe (not in WhatsApp or ordinary email). Download one at least weekly.')}</p>
        <a className="btn" href="/admin/backup/export">{m('تنزيل نسخة احتياطية الآن', 'Download a backup now')}</a>
        <p className="muted" style={{ marginTop: 14 }}>{m('الاستعادة تتم بواسطة المطوّر بأمر واحد (bun scripts/restore.ts الملف) ولا تتم من هذه الصفحة حتى لا تُمسح البيانات بالخطأ.', 'Restoring is done by the developer with one command (bun scripts/restore.ts file) and not from this page, so data cannot be wiped by accident.')}</p>
      </div>
    </>
  );
}
