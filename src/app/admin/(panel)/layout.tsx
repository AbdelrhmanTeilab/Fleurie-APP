import { can, requireStaff } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { staffLogoutAction } from '@/app/actions/staff';
import { Brand, LangSwitch } from '@/components/Shell';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const u = await requireStaff(); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const items = [
    { href: '/admin', ar: 'الرئيسية', en: 'Overview', show: true },
    { href: '/admin/bookings', ar: 'الحجوزات', en: 'Bookings', show: can(u, 'bookings.all') || can(u, 'bookings.own') },
    { href: '/admin/calendar', ar: 'التقويم', en: 'Calendar', show: can(u, 'bookings.all') || can(u, 'bookings.own') },
    { href: '/admin/services', ar: 'الجلسات والخدمات', en: 'Sessions & services', show: can(u, 'services.manage') },
    { href: '/admin/offers', ar: 'العروض', en: 'Offers', show: can(u, 'services.manage') },
    { href: '/admin/inventory', ar: 'المخزون', en: 'Inventory', show: can(u, 'inventory.manage') },
    { href: '/admin/suppliers', ar: 'الموردون والمشتريات', en: 'Suppliers & purchases', show: can(u, 'suppliers.manage') },
    { href: '/admin/finance', ar: 'الحسابات', en: 'Finance', show: can(u, 'finance.view') },
    { href: '/admin/customers', ar: 'العملاء', en: 'Customers', show: can(u, 'customers.view') },
    { href: '/admin/staff', ar: 'الموظفون والصلاحيات', en: 'Staff & roles', show: can(u, 'staff.manage') },
    { href: '/admin/schedule', ar: 'الجداول والأداء', en: 'Schedules & performance', show: can(u, 'staff.manage') },
    { href: '/admin/appearance', ar: 'المظهر والمحتوى', en: 'Appearance & content', show: can(u, 'settings.manage') },
    { href: '/admin/messages', ar: 'قوالب الرسائل والتذكيرات', en: 'Templates & reminders', show: can(u, 'settings.manage') },
    { href: '/admin/outbox', ar: 'الرسائل والأكواد', en: 'Outbox & codes', show: can(u, 'customers.manage') },
    { href: '/admin/backup', ar: 'النسخ الاحتياطي', en: 'Backup', show: can(u, 'staff.manage') },
    { href: '/admin/logs', ar: 'سجل النشاط', en: 'Activity log', show: can(u, 'logs.view') },
  ].filter(i => i.show);
  return (
    <div className="admin">
      <aside className="side">
        <Brand />
        {items.map(i => <a key={i.href} href={i.href}>{m(i.ar, i.en)}</a>)}
        <div style={{ marginTop: 'auto' }}>
          <div className="muted" style={{ padding: '8px 14px' }}>{lang === 'ar' ? u.nameAr : u.nameEn}<br /><span className="tag">{lang === 'ar' ? u.role.nameAr : u.role.nameEn}</span></div>
          <a href="/admin/change-password">{m('تغيير كلمة المرور', 'Change password')}</a>
          <LangSwitch />
          <form action={staffLogoutAction}><button className="navbtn">{m('تسجيل الخروج', 'Sign out')}</button></form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
