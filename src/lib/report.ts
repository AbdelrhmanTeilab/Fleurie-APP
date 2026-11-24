import { and, eq, gte, lt } from 'drizzle-orm';
import { schema as s } from '@/db';
import { addDays, zonedToUtc } from './time';

// Money rule: only approved payments count; a refund subtracts. Pending/rejected proofs are never revenue.
export async function loadRange(db: any, from: string, toExclusive: string, tz: string) {
  const a = zonedToUtc(from, 0, tz), b = zonedToUtc(toExclusive, 0, tz);
  const bookings = await db.select().from(s.bookings).where(and(gte(s.bookings.startsAt, a), lt(s.bookings.startsAt, b)));
  const pays = await db.select().from(s.payments).where(and(eq(s.payments.status, 'approved'), gte(s.payments.reviewedAt, a), lt(s.payments.reviewedAt, b)));
  return { bookings, pays };
}
export const dayOf = (d: Date | string, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
export const net = (p: { kind: string; amount: number }) => (p.kind === 'refund' ? -p.amount : p.amount);
export function daysBetween(from: string, n: number) { return Array.from({ length: n }, (_, i) => addDays(from, i)); }
