import { and, desc, eq, isNull } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { newOtp, sha256 } from './crypto';
import { sendNotification } from './notify';

export const OTP_TTL_MS = 10 * 60_000, OTP_MAX_ATTEMPTS = 5, OTP_RESEND_MS = 60_000;

export async function issueOtp(customer: { id: number; whatsapp: string; email: string; name: string }, purpose: 'verify' | 'reset', channel: 'whatsapp' | 'email', brandName: string, lang: 'ar' | 'en') {
  const db = await getDb();
  const [last] = await db.select().from(s.otpCodes).where(and(eq(s.otpCodes.customerId, customer.id), eq(s.otpCodes.purpose, purpose))).orderBy(desc(s.otpCodes.createdAt)).limit(1);
  if (last && Date.now() - new Date(last.createdAt).getTime() < OTP_RESEND_MS) return { ok: false as const, wait: true };
  const code = newOtp();
  await db.insert(s.otpCodes).values({ customerId: customer.id, purpose, channel, codeHash: sha256(`${customer.id}:${code}`), expiresAt: new Date(Date.now() + OTP_TTL_MS) });
  const body = lang === 'ar' ? `كود التحقق الخاص بك في ${brandName}: ${code}\nصالح لمدة 10 دقائق. لا تشاركه مع أحد.` : `Your ${brandName} verification code: ${code}\nValid for 10 minutes. Do not share it.`;
  await sendNotification({ customerId: customer.id, channel, to: channel === 'email' ? customer.email : customer.whatsapp, template: `otp_${purpose}`, body, subject: `${brandName} - ${lang === 'ar' ? 'كود التحقق' : 'Verification code'}` });
  return { ok: true as const };
}

export async function checkOtp(customerId: number, purpose: 'verify' | 'reset', code: string): Promise<'ok' | 'invalid' | 'expired' | 'locked'> {
  const db = await getDb();
  const [row] = await db.select().from(s.otpCodes).where(and(eq(s.otpCodes.customerId, customerId), eq(s.otpCodes.purpose, purpose), isNull(s.otpCodes.usedAt))).orderBy(desc(s.otpCodes.createdAt)).limit(1);
  if (!row) return 'expired';
  if (new Date(row.expiresAt).getTime() < Date.now()) return 'expired';
  if (row.attempts >= OTP_MAX_ATTEMPTS) return 'locked';
  if (row.codeHash !== sha256(`${customerId}:${code.trim()}`)) {
    await db.update(s.otpCodes).set({ attempts: row.attempts + 1 }).where(eq(s.otpCodes.id, row.id));
    return 'invalid';
  }
  await db.update(s.otpCodes).set({ usedAt: new Date() }).where(eq(s.otpCodes.id, row.id));
  return 'ok';
}
