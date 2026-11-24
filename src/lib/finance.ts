import { and, gte, lt, inArray, eq } from 'drizzle-orm';
import { schema as s } from '@/db';
import { addDays, zonedToUtc } from './time';
import { dayOf, net } from './report';

// Cash-basis: profit = money actually collected (approved payments minus refunds) - money actually spent (expenses incl. supplier payments).
// Consumed product cost is informational only (it was already paid through purchases), so it is never subtracted again.
export async function loadFinance(db: any, from: string, to: string, tz: string) {
  const a = zonedToUtc(from, 0, tz), b = zonedToUtc(addDays(to, 1), 0, tz);
  const pays = await db.select({ p: s.payments, b: s.bookings }).from(s.payments).innerJoin(s.bookings, eq(s.bookings.id, s.payments.bookingId))
    .where(and(eq(s.payments.status, 'approved'), gte(s.payments.reviewedAt, a), lt(s.payments.reviewedAt, b)));
  const expenses = (await db.select().from(s.expenses)).filter((e: any) => e.date >= from && e.date <= to).sort((x: any, y: any) => (x.date < y.date ? 1 : -1));
  const consume = await db.select().from(s.stockMovements).where(and(eq(s.stockMovements.kind, 'consume'), gte(s.stockMovements.createdAt, a), lt(s.stockMovements.createdAt, b)));
  const open = await db.select({ b: s.bookings, c: s.customers.name }).from(s.bookings).innerJoin(s.customers, eq(s.customers.id, s.bookings.customerId)).where(inArray(s.bookings.status, ['confirmed', 'completed']));
  const allPays = await db.select().from(s.payments).where(eq(s.payments.status, 'approved'));
  const outstanding = open.map((x: any) => ({ ...x, paid: allPays.filter((p: any) => p.bookingId === x.b.id).reduce((t: number, p: any) => t + net(p), 0) }))
    .map((x: any) => ({ ...x, due: x.b.price - x.paid })).filter((x: any) => x.due > 0);
  const revenue = pays.reduce((t: number, x: any) => t + net(x.p), 0);
  const spent = expenses.reduce((t: number, e: any) => t + e.amount, 0);
  const byCat = new Map<string, number>(); for (const e of expenses) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  const bySvc = new Map<string, number>(); for (const x of pays) bySvc.set(x.b.serviceNameEn + '|' + x.b.serviceNameAr, (bySvc.get(x.b.serviceNameEn + '|' + x.b.serviceNameAr) ?? 0) + net(x.p));
  const consumed = Math.round(consume.reduce((t: number, c: any) => t + Math.abs(c.qty) * c.unitCost, 0));
  return { pays, expenses, revenue, spent, profit: revenue - spent, byCat, bySvc, consumed, outstanding, dayOf };
}
