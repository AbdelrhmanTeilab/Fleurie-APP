import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { and, eq, gt } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { newToken, sha256 } from './crypto';
import type { Permission } from './permissions';

const IS_PROD = process.env.NODE_ENV === 'production';
function secret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const f = path.join(process.cwd(), '.data', 'secret');
  fs.mkdirSync(path.dirname(f), { recursive: true });
  if (!fs.existsSync(f)) fs.writeFileSync(f, randomBytes(32).toString('hex'));
  return fs.readFileSync(f, 'utf8');
}
export function sign(value: string): string { return `${value}.${createHmac('sha256', secret()).update(value).digest('hex')}`; }
export function unsign(signed?: string): string | null {
  if (!signed) return null;
  const i = signed.lastIndexOf('.'); if (i < 0) return null;
  const v = signed.slice(0, i), mac = Buffer.from(signed.slice(i + 1), 'hex'), exp = createHmac('sha256', secret()).update(v).digest();
  return mac.length === exp.length && timingSafeEqual(mac, exp) ? v : null;
}

const COOKIE = { customer: 'fl_c', staff: 'fl_s' } as const;
const TTL = { customer: 30 * 864e5, staff: 12 * 36e5 } as const;

export async function startSession(kind: 'customer' | 'staff', userId: number) {
  const db = await getDb(), token = newToken();
  await db.insert(s.authSessions).values({ tokenHash: sha256(token), kind, userId, expiresAt: new Date(Date.now() + TTL[kind]) });
  (await cookies()).set(COOKIE[kind], token, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/', maxAge: TTL[kind] / 1000 });
}
export async function endSession(kind: 'customer' | 'staff') {
  const c = await cookies(), token = c.get(COOKIE[kind])?.value;
  if (token) { const db = await getDb(); await db.delete(s.authSessions).where(eq(s.authSessions.tokenHash, sha256(token))); }
  c.delete(COOKIE[kind]);
}
async function sessionUser(kind: 'customer' | 'staff'): Promise<number | null> {
  const token = (await cookies()).get(COOKIE[kind])?.value; if (!token) return null;
  const db = await getDb();
  const [row] = await db.select().from(s.authSessions).where(and(eq(s.authSessions.tokenHash, sha256(token)), eq(s.authSessions.kind, kind), gt(s.authSessions.expiresAt, new Date())));
  return row?.userId ?? null;
}

export async function getCustomer() {
  const id = await sessionUser('customer'); if (!id) return null;
  const db = await getDb();
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, id));
  return c && c.status === 'active' ? c : null;
}
export async function requireCustomer() { const c = await getCustomer(); if (!c) redirect('/login'); return c; }

export async function getStaff() {
  const id = await sessionUser('staff'); if (!id) return null;
  const db = await getDb();
  const [m] = await db.select().from(s.staff).where(eq(s.staff.id, id));
  if (!m || !m.active) return null;
  const [role] = await db.select().from(s.roles).where(eq(s.roles.id, m.roleId));
  const perms = (await db.select().from(s.rolePermissions).where(eq(s.rolePermissions.roleId, m.roleId))).map((p: any) => p.permission as Permission);
  return { ...m, passwordHash: undefined as unknown as string, role, perms: new Set<Permission>(perms) };
}
export type StaffUser = NonNullable<Awaited<ReturnType<typeof getStaff>>>;
export const can = (u: StaffUser, p: Permission) => u.perms.has(p);

// Every admin page and action must call this. Throws a redirect if not allowed.
export async function requireStaff(perm?: Permission, opts: { allowMustChange?: boolean } = {}): Promise<StaffUser> {
  const u = await getStaff(); if (!u) redirect('/admin/login');
  if (u.mustChangePassword && !opts.allowMustChange) redirect('/admin/change-password');
  if (perm && !can(u, perm)) redirect('/admin?denied=1');
  return u;
}

// Short-lived signed cookie remembering which customer is mid-verification (no account data exposed in URLs).
export async function setPending(customerId: number, purpose: 'verify' | 'reset') {
  (await cookies()).set('fl_pending', sign(`${customerId}:${purpose}:${Date.now() + 30 * 6e4}`), { httpOnly: true, sameSite: 'lax', secure: IS_PROD, path: '/', maxAge: 1800 });
}
export async function getPending(): Promise<{ customerId: number; purpose: 'verify' | 'reset' } | null> {
  const v = unsign((await cookies()).get('fl_pending')?.value); if (!v) return null;
  const [id, purpose, exp] = v.split(':');
  if (Number(exp) < Date.now() || (purpose !== 'verify' && purpose !== 'reset')) return null;
  return { customerId: Number(id), purpose };
}
export async function clearPending() { (await cookies()).delete('fl_pending'); }
