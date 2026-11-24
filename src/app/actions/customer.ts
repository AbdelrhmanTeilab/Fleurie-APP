'use server';
import { limited } from '@/lib/ratelimit';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { and, eq, or } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema as s } from '@/db';
import { clearPending, endSession, getCustomer, getPending, setPending, startSession } from '@/lib/auth';
import { hashPassword, passwordProblem, verifyPassword } from '@/lib/crypto';
import { getI18n } from '@/lib/i18n';
import { normalizePhone } from '@/lib/phone';
import { checkOtp, issueOtp } from '@/lib/otp';
import { logAction } from '@/lib/audit';

export type FormState = { error?: string; ok?: string } | undefined;
const MAX_FAILS = 5, LOCK_MS = 15 * 60_000;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function setLanguage(lang: 'ar' | 'en') {
  (await cookies()).set('fl_lang', lang, { path: '/', maxAge: 365 * 864e5, sameSite: 'lax' });
  revalidatePath('/', 'layout');
}

export async function registerAction(_: FormState, f: FormData): Promise<FormState> {
  const { lang, brand } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (await limited('register', 8, 3600e3)) return { error: m('محاولات كثيرة. حاولي لاحقًا.', 'Too many attempts. Please try again later.') };
  const phone = normalizePhone(str(f, 'whatsapp'));
  const parsed = z.object({ name: z.string().min(2).max(100), email: z.string().email().max(200), password: z.string().max(200) }).safeParse({ name: str(f, 'name'), email: str(f, 'email').toLowerCase(), password: String(f.get('password') ?? '') });
  if (!parsed.success || !phone) return { error: m('تأكد من الاسم ورقم الواتساب والبريد الإلكتروني', 'Please check your name, WhatsApp number and email') };
  if (passwordProblem(parsed.data.password)) return { error: m('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتشمل حروفًا وأرقامًا', 'Password must be at least 8 characters with letters and numbers') };
  const first = str(f, 'firstSession');
  if (first && (isNaN(Date.parse(first)) || first > new Date().toISOString().slice(0, 10))) return { error: m('تاريخ أول جلسة غير صحيح', 'Invalid first-session date') };
  const channel = str(f, 'channel') === 'email' ? 'email' : 'whatsapp';

  const db = await getDb();
  const dupes = await db.select().from(s.customers).where(or(eq(s.customers.whatsapp, phone), eq(s.customers.email, parsed.data.email)));
  if (dupes.some((c: any) => c.status !== 'pending')) return { error: m('يوجد حساب بهذا الرقم أو البريد. سجّل الدخول أو استعد كلمة المرور.', 'An account with this number or email already exists. Sign in or recover your password.') };
  if (dupes.length > 1 || (dupes[0] && (dupes[0].whatsapp !== phone || dupes[0].email !== parsed.data.email))) return { error: m('هذا الرقم أو البريد مستخدم في تسجيل آخر غير مكتمل', 'This number or email belongs to another unfinished registration') };

  const values = { name: parsed.data.name, whatsapp: phone, email: parsed.data.email, passwordHash: hashPassword(parsed.data.password), firstSessionDate: first || null, language: lang, reminderEnabled: f.get('reminders') === 'on', reminderChannel: channel };
  let customer = dupes[0];
  if (customer) [customer] = await db.update(s.customers).set(values).where(eq(s.customers.id, customer.id)).returning();
  else [customer] = await db.insert(s.customers).values(values).returning();

  const r = await issueOtp(customer, 'verify', channel, brand.name, lang);
  await setPending(customer.id, 'verify');
  await logAction({ kind: 'customer', id: customer.id, name: customer.name }, 'customer.register', 'customer', customer.id);
  redirect(r.ok ? '/verify' : '/verify?wait=1');
}

export async function verifyAction(_: FormState, f: FormData): Promise<FormState> {
  const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const p = await getPending(); if (!p || p.purpose !== 'verify') redirect('/');
  const res = await checkOtp(p.customerId, 'verify', str(f, 'code'));
  if (res === 'invalid') return { error: m('الكود غير صحيح', 'Incorrect code') };
  if (res === 'locked') return { error: m('محاولات كثيرة. اطلب كودًا جديدًا.', 'Too many attempts. Request a new code.') };
  if (res === 'expired') return { error: m('انتهت صلاحية الكود. اطلب كودًا جديدًا.', 'Code expired. Request a new one.') };
  const db = await getDb();
  const [c] = await db.update(s.customers).set({ status: 'active', verifiedAt: new Date() }).where(eq(s.customers.id, p.customerId)).returning();
  await clearPending(); await startSession('customer', c.id);
  await logAction({ kind: 'customer', id: c.id, name: c.name }, 'customer.verified', 'customer', c.id);
  redirect('/account');
}

export async function resendAction(): Promise<FormState> {
  const { lang, brand } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (await limited('resend', 8, 3600e3)) return { error: m('محاولات كثيرة. حاولي لاحقًا.', 'Too many attempts. Please try again later.') };
  const p = await getPending(); if (!p) redirect('/');
  const db = await getDb(); const [c] = await db.select().from(s.customers).where(eq(s.customers.id, p.customerId));
  if (!c) redirect('/');
  const r = await issueOtp(c, p.purpose, c.reminderChannel === 'email' ? 'email' : 'whatsapp', brand.name, lang);
  return r.ok ? { ok: m('تم إرسال كود جديد', 'A new code was sent') } : { error: m('انتظر دقيقة قبل طلب كود جديد', 'Please wait a minute before requesting another code') };
}

export async function loginAction(_: FormState, f: FormData): Promise<FormState> {
  const { lang, brand } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (await limited('login', 30, 15 * 60e3)) return { error: m('محاولات كثيرة. حاولي بعد قليل.', 'Too many attempts. Try again shortly.') };
  const id = str(f, 'identifier'), pw = String(f.get('password') ?? '');
  const phone = normalizePhone(id);
  const db = await getDb();
  const [c] = await db.select().from(s.customers).where(phone ? eq(s.customers.whatsapp, phone) : eq(s.customers.email, id.toLowerCase()));
  const bad = { error: m('بيانات الدخول غير صحيحة', 'Incorrect sign-in details') };
  if (!c) { verifyPassword(pw, 'scrypt$00$00'); return bad; }
  if (c.lockedUntil && new Date(c.lockedUntil) > new Date()) return { error: m('تم إيقاف المحاولات مؤقتًا. حاول بعد 15 دقيقة.', 'Too many attempts. Try again in 15 minutes.') };
  if (!verifyPassword(pw, c.passwordHash)) {
    const fails = c.failedAttempts + 1;
    await db.update(s.customers).set({ failedAttempts: fails >= MAX_FAILS ? 0 : fails, lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MS) : null }).where(eq(s.customers.id, c.id));
    return bad;
  }
  await db.update(s.customers).set({ failedAttempts: 0, lockedUntil: null }).where(eq(s.customers.id, c.id));
  if (c.status === 'blocked') return { error: m('هذا الحساب موقوف. تواصل مع المركز.', 'This account is suspended. Please contact the center.') };
  if (c.status === 'pending') { await issueOtp(c, 'verify', c.reminderChannel === 'email' ? 'email' : 'whatsapp', brand.name, lang); await setPending(c.id, 'verify'); redirect('/verify'); }
  await startSession('customer', c.id);
  redirect('/account');
}

export async function forgotAction(_: FormState, f: FormData): Promise<FormState> {
  const { lang, brand } = await getI18n();
  if (await limited('forgot', 8, 3600e3)) return { error: lang === 'ar' ? 'محاولات كثيرة. حاولي لاحقًا.' : 'Too many attempts. Please try again later.' };
  const id = str(f, 'identifier'), phone = normalizePhone(id), channel = str(f, 'channel') === 'email' ? 'email' : 'whatsapp';
  const db = await getDb();
  const [c] = await db.select().from(s.customers).where(and(phone ? eq(s.customers.whatsapp, phone) : eq(s.customers.email, id.toLowerCase()), eq(s.customers.status, 'active')));
  if (c) { await issueOtp(c, 'reset', channel, brand.name, lang); await setPending(c.id, 'reset'); }
  else await setPending(0, 'reset'); // same response either way: no account enumeration
  redirect('/reset');
}

export async function resetAction(_: FormState, f: FormData): Promise<FormState> {
  const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const p = await getPending(); if (!p || p.purpose !== 'reset') redirect('/forgot');
  const pw = String(f.get('password') ?? '');
  if (passwordProblem(pw)) return { error: m('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتشمل حروفًا وأرقامًا', 'Password must be at least 8 characters with letters and numbers') };
  const res = p.customerId ? await checkOtp(p.customerId, 'reset', str(f, 'code')) : 'invalid';
  if (res !== 'ok') return { error: res === 'expired' ? m('انتهت صلاحية الكود', 'Code expired') : m('الكود غير صحيح', 'Incorrect code') };
  const db = await getDb();
  await db.update(s.customers).set({ passwordHash: hashPassword(pw), failedAttempts: 0, lockedUntil: null }).where(eq(s.customers.id, p.customerId));
  await db.delete(s.authSessions).where(and(eq(s.authSessions.kind, 'customer'), eq(s.authSessions.userId, p.customerId)));
  await clearPending(); await logAction({ kind: 'customer', id: p.customerId }, 'customer.password_reset', 'customer', p.customerId);
  redirect('/login?reset=1');
}

export async function logoutAction() { await endSession('customer'); redirect('/'); }

export async function updateProfileAction(_: FormState, f: FormData): Promise<FormState> {
  const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const c = await getCustomer(); if (!c) redirect('/login');
  const name = str(f, 'name'), first = str(f, 'firstSession'), day = Math.min(90, Math.max(7, Number(f.get('reminderDay')) || 30));
  if (name.length < 2) return { error: m('الاسم مطلوب', 'Name is required') };
  if (first && (isNaN(Date.parse(first)) || first > new Date().toISOString().slice(0, 10))) return { error: m('تاريخ غير صحيح', 'Invalid date') };
  const db = await getDb();
  await db.update(s.customers).set({ name, firstSessionDate: first || null, reminderEnabled: f.get('reminders') === 'on', reminderDay: day, reminderChannel: str(f, 'channel') === 'email' ? 'email' : 'whatsapp' }).where(eq(s.customers.id, c.id));
  revalidatePath('/account');
  return { ok: m('تم الحفظ', 'Saved') };
}
