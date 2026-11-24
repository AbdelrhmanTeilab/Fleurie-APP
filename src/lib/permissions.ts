export const PERMISSIONS = {
  'dashboard.view': { ar: 'عرض لوحة التحكم', en: 'View dashboard' },
  'bookings.all': { ar: 'إدارة كل الحجوزات', en: 'Manage all bookings' },
  'bookings.own': { ar: 'حجوزاتي فقط', en: 'Own bookings only' },
  'customers.view': { ar: 'عرض العملاء', en: 'View customers' },
  'customers.manage': { ar: 'تعديل العملاء والملاحظات', en: 'Edit customers and notes' },
  'recommendations.write': { ar: 'كتابة توصيات العناية', en: 'Write care recommendations' },
  'payments.manage': { ar: 'إدارة العربون والمدفوعات', en: 'Manage deposits and payments' },
  'finance.view': { ar: 'الحسابات والتقارير المالية', en: 'Finance and reports' },
  'services.manage': { ar: 'إدارة الجلسات والعروض', en: 'Manage sessions and offers' },
  'inventory.manage': { ar: 'إدارة المخزون', en: 'Manage inventory' },
  'suppliers.manage': { ar: 'إدارة الموردين', en: 'Manage suppliers' },
  'staff.manage': { ar: 'إدارة الموظفين والصلاحيات', en: 'Manage staff and roles' },
  'settings.manage': { ar: 'المظهر والمحتوى والإعدادات', en: 'Appearance, content and settings' },
  'logs.view': { ar: 'سجل النشاط', en: 'Activity log' },
} as const;
export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

export const DEFAULT_ROLES: { key: string; ar: string; en: string; perms: Permission[] }[] = [
  { key: 'full_admin', ar: 'مدير كامل', en: 'Full Admin', perms: ALL_PERMISSIONS },
  { key: 'booking_manager', ar: 'مسؤول الحجوزات', en: 'Booking Manager', perms: ['dashboard.view', 'bookings.all', 'customers.view', 'customers.manage', 'payments.manage'] },
  { key: 'specialist', ar: 'أخصائي', en: 'Specialist', perms: ['bookings.own', 'customers.view', 'recommendations.write'] },
  { key: 'accountant', ar: 'محاسب', en: 'Accountant', perms: ['dashboard.view', 'finance.view', 'payments.manage', 'suppliers.manage'] },
  { key: 'inventory_manager', ar: 'مسؤول المخزون', en: 'Inventory Manager', perms: ['inventory.manage', 'suppliers.manage'] },
];
