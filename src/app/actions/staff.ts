'use server';
import { limited } from '@/lib/ratelimit';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, ne } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { endSession, getStaff, requireStaff, startSession } from '@/lib/auth';
import { hashPassword, passwordProblem, randomPassword, verifyPassword } from '@/lib/crypto';
import { logAction } from '@/lib/audit';
import { saveImage } from '@/lib/upload';
import { ALL_PERMISSIONS } from '@/lib/permissions';
import { DEFAULT_LABELS } from '@/lib/labels';
import { DEFAULT_SETTINGS } from '@/db/seed';
import { getLang } from '@/lib/i18n';

export type FormState = { error?: string; ok?: string; secret?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const HEX = /^#[0-9a-fA-F]{6}$/;
const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;

export async function staffLoginAction(_: FormState, f: FormData): Promise<FormState> {
  const m = async (ar: string, en: string) => ((await getLang()) === 'ar' ? ar : en);
  if (await limited('staff-login', 20, 15 * 60e3)) return { error: await m('محاولات كثيرة. حاول بعد قليل.', 'Too many attempts. Try again shortly.') };
  const email = str(f, 'email').toLowerCase(), pw = String(f.get('password') ?? '');
  const db = await getDb();
  const [u] = await db.select().from(s.staff).where(eq(s.staff.email, email));
  const bad = { error: await m('بيانات الدخول غير صحيحة', 'Incorrect sign-in details') };
  if (!u || !u.active) { verifyPassword(pw, 'scrypt$00$00'); return bad; }
  if (u.lockedUntil && new Date(u.lockedUntil) > new Date()) return { error: await m('تم إيقاف المحاولات مؤقتًا. حاول بعد 15 دقيقة.', 'Too many attempts. Try again in 15 minutes.') };
  if (!verifyPassword(pw, u.passwordHash)) {
    const fails = u.failedAttempts + 1;
    await db.update(s.staff).set({ failedAttempts: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null }).where(eq(s.staff.id, u.id));
    await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'staff.login_failed', 'staff', u.id);
    return bad;
  }
  await db.update(s.staff).set({ failedAttempts: 0, lockedUntil: null }).where(eq(s.staff.id, u.id));
  await startSession('staff', u.id); await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'staff.login', 'staff', u.id);
  redirect(u.mustChangePassword ? '/admin/change-password' : '/admin');
}
export async function staffLogoutAction() { await endSession('staff'); redirect('/admin/login'); }

export async function changePasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff(undefined, { allowMustChange: true });
  const ar = (await getLang()) === 'ar', cur = String(f.get('current') ?? ''), next = String(f.get('next') ?? '');
  const db = await getDb(); const [row] = await db.select().from(s.staff).where(eq(s.staff.id, u.id));
  if (!verifyPassword(cur, row.passwordHash)) return { error: ar ? 'كلمة المرور الحالية غير صحيحة' : 'Current password is incorrect' };
  if (passwordProblem(next)) return { error: ar ? 'كلمة المرور الجديدة: 8 أحرف على الأقل مع حروف وأرقام' : 'New password: at least 8 characters with letters and numbers' };
  if (next === cur) return { error: ar ? 'اختر كلمة مرور مختلفة' : 'Choose a different password' };
  await db.update(s.staff).set({ passwordHash: hashPassword(next), mustChangePassword: false }).where(eq(s.staff.id, u.id));
  { const tok = (await (await import('next/headers')).cookies()).get('fl_s')?.value; const keep = tok ? (await import('@/lib/crypto')).sha256(tok) : ''; await db.delete(s.authSessions).where(and(eq(s.authSessions.kind, 'staff'), eq(s.authSessions.userId, u.id), ne(s.authSessions.tokenHash, keep))); }
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'staff.password_changed', 'staff', u.id);
  redirect('/admin');
}

// ---------- Appearance and content ----------
export async function saveBrandAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('settings.manage'); const ar = (await getLang()) === 'ar';
  const db = await getDb();
  const keys = ['brand.name_ar', 'brand.name_en', 'brand.slogan_ar', 'brand.slogan_en', 'brand.phone', 'brand.address_ar', 'brand.address_en', 'payment.instructions_ar', 'payment.instructions_en', 'booking.deposit_percent_default'];
  const values: Record<string, string> = {};
  for (const k of keys) values[k] = str(f, k).slice(0, 500);
  if (!values['brand.name_ar'] || !values['brand.name_en']) return { error: ar ? 'اسم المركز مطلوب بالعربية والإنجليزية' : 'Center name is required in Arabic and English' };
  const dep = Number(values['booking.deposit_percent_default']); if (!(dep >= 0 && dep <= 100)) return { error: ar ? 'نسبة العربون بين 0 و 100' : 'Deposit percentage must be 0 to 100' };
  for (const k of ['theme.primary', 'theme.accent', 'theme.bg', 'theme.surface', 'theme.text']) { const v = str(f, k); if (!HEX.test(v)) return { error: ar ? 'لون غير صالح' : 'Invalid color' }; values[k] = v; }
  const img = await saveImage(f.get('logo') as File | null);
  if (img.error) return { error: img.error === 'size' ? (ar ? 'الشعار أكبر من 3 ميجابايت' : 'Logo is larger than 3 MB') : (ar ? 'الشعار يجب أن يكون PNG أو JPG أو WEBP' : 'Logo must be PNG, JPG or WEBP') };
  if (img.name) values['brand.logo'] = img.name;
  if (f.get('removeLogo') === 'on') values['brand.logo'] = '';
  for (const [key, value] of Object.entries(values)) await db.insert(s.siteSettings).values({ key, value }).onConflictDoUpdate({ target: s.siteSettings.key, set: { value } });
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'settings.brand_saved', 'settings', 'brand', { keys: Object.keys(values) });
  revalidatePath('/', 'layout'); return { ok: ar ? 'تم حفظ الإعدادات' : 'Settings saved' };
}
export async function resetThemeAction() {
  const u = await requireStaff('settings.manage'); const db = await getDb();
  for (const k of ['theme.primary', 'theme.accent', 'theme.bg', 'theme.surface', 'theme.text']) await db.insert(s.siteSettings).values({ key: k, value: DEFAULT_SETTINGS[k] }).onConflictDoUpdate({ target: s.siteSettings.key, set: { value: DEFAULT_SETTINGS[k] } });
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'settings.theme_reset'); revalidatePath('/', 'layout');
}
export async function saveLabelsAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('settings.manage'); const ar = (await getLang()) === 'ar';
  const db = await getDb(); let n = 0;
  for (const key of Object.keys(DEFAULT_LABELS)) for (const lang of ['ar', 'en'] as const) {
    const v = str(f, `${lang}:${key}`).slice(0, 300);
    if (!v || v === DEFAULT_LABELS[key][lang]) { await db.delete(s.siteLabels).where(and(eq(s.siteLabels.key, key), eq(s.siteLabels.lang, lang))); continue; }
    await db.insert(s.siteLabels).values({ key, lang, value: v }).onConflictDoUpdate({ target: [s.siteLabels.key, s.siteLabels.lang], set: { value: v } }); n++;
  }
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'settings.labels_saved', 'settings', 'labels', { overrides: n });
  revalidatePath('/', 'layout'); return { ok: ar ? `تم الحفظ (${n} نص مخصص)` : `Saved (${n} custom texts)` };
}

// ---------- Staff and roles ----------
export async function saveStaffAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('staff.manage'); const ar = (await getLang()) === 'ar';
  const db = await getDb(); const id = Number(f.get('id')) || 0;
  const v = { nameAr: str(f, 'nameAr'), nameEn: str(f, 'nameEn'), email: str(f, 'email').toLowerCase(), phone: str(f, 'phone'), roleId: Number(f.get('roleId')), active: f.get('active') === 'on' };
  if (!v.nameAr || !v.nameEn || !/^\S+@\S+$/.test(v.email) || !v.roleId) return { error: ar ? 'أكمل الاسم (بالعربية والإنجليزية) والبريد والدور' : 'Complete the name (Arabic and English), email and role' };
  const days = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'];
  const hours: Record<string, { from: string; to: string } | null> = {};
  for (const d of days) hours[d] = f.get(`off_${d}`) === 'on' ? null : { from: str(f, `from_${d}`) || '11:00', to: str(f, `to_${d}`) || '19:00' };
  const cats = (await db.select().from(s.serviceCategories)).filter((c: any) => f.get(`cat_${c.id}`) === 'on').map((c: any) => ({ categoryId: c.id, priority: f.get(`support_${c.id}`) === 'on' ? 2 : 1 }));
  let secret: string | undefined, sid = id;
  try {
    if (id) {
      if (id === u.id && (!v.active || v.roleId !== u.roleId)) return { error: ar ? 'لا يمكنك تعطيل حسابك أو تغيير دورك' : 'You cannot deactivate your own account or change your own role' };
      await db.update(s.staff).set({ ...v, workingHours: hours }).where(eq(s.staff.id, id));
    } else {
      secret = randomPassword();
      const [row] = await db.insert(s.staff).values({ ...v, workingHours: hours, passwordHash: hashPassword(secret) }).returning(); sid = row.id;
    }
  } catch { return { error: ar ? 'هذا البريد مستخدم لموظف آخر' : 'This email belongs to another staff member' }; }
  await db.delete(s.staffCategories).where(eq(s.staffCategories.staffId, sid));
  if (cats.length) await db.insert(s.staffCategories).values(cats.map((c: any) => ({ ...c, staffId: sid })));
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, id ? 'staff.updated' : 'staff.created', 'staff', sid);
  revalidatePath('/admin/staff');
  return { ok: ar ? 'تم الحفظ' : 'Saved', secret };
}
export async function resetStaffPasswordAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('staff.manage'); const id = Number(f.get('id')); const db = await getDb();
  const secret = randomPassword();
  await db.update(s.staff).set({ passwordHash: hashPassword(secret), mustChangePassword: true, failedAttempts: 0, lockedUntil: null }).where(eq(s.staff.id, id));
  await db.delete(s.authSessions).where(and(eq(s.authSessions.kind, 'staff'), eq(s.authSessions.userId, id)));
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'staff.password_reset', 'staff', id);
  return { ok: 'OK', secret };
}
export async function saveRoleAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('staff.manage'); const ar = (await getLang()) === 'ar'; const db = await getDb();
  const id = Number(f.get('id')); const [role] = await db.select().from(s.roles).where(eq(s.roles.id, id));
  if (!role || role.system) return { error: ar ? 'لا يمكن تعديل صلاحيات المدير الكامل' : 'Full Admin permissions cannot be edited' };
  await db.delete(s.rolePermissions).where(eq(s.rolePermissions.roleId, id));
  const perms = ALL_PERMISSIONS.filter(p => f.get(p) === 'on');
  if (perms.length) await db.insert(s.rolePermissions).values(perms.map(permission => ({ roleId: id, permission })));
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'role.updated', 'role', id, { perms });
  revalidatePath('/admin/staff'); return { ok: ar ? 'تم حفظ الصلاحيات' : 'Permissions saved' };
}
export async function markNotificationSentAction(f: FormData) {
  await requireStaff('customers.manage'); const db = await getDb();
  await db.update(s.notifications).set({ status: 'sent', sentAt: new Date() }).where(eq(s.notifications.id, Number(f.get('id'))));
  revalidatePath('/admin/outbox');
}

export async function addNoteAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('customers.manage'); const ar = (await getLang()) === 'ar'; const db = await getDb();
  const body = str(f, 'body').slice(0, 2000), customerId = Number(f.get('customerId'));
  if (!body) return { error: ar ? 'اكتب الملاحظة' : 'Write a note' };
  await db.insert(s.customerNotes).values({ customerId, staffId: u.id, body });
  await logAction({ kind: 'staff', id: u.id, name: u.nameEn }, 'customer.note_added', 'customer', customerId);
  revalidatePath(`/admin/customers/${customerId}`); return { ok: ar ? 'تمت الإضافة' : 'Note added' };
}
