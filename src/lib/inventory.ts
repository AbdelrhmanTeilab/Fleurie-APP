import { and, eq, sql } from 'drizzle-orm';
import { schema as s } from '@/db';

// Deducts the products linked to a service when a session is completed. Safe to call twice (it checks for earlier movements).
export async function consumeForBooking(db: any, booking: { id: number; serviceId: number }, staffId: number | null) {
  const done = await db.select({ id: s.stockMovements.id }).from(s.stockMovements).where(and(eq(s.stockMovements.bookingId, booking.id), eq(s.stockMovements.kind, 'consume'))).limit(1);
  if (done.length) return 0;
  const links = await db.select().from(s.serviceProducts).where(eq(s.serviceProducts.serviceId, booking.serviceId));
  for (const l of links) {
    const [p] = await db.select().from(s.products).where(eq(s.products.id, l.productId)); if (!p) continue;
    await db.update(s.products).set({ stock: sql`${s.products.stock} - ${l.qty}` }).where(eq(s.products.id, p.id));
    await db.insert(s.stockMovements).values({ productId: p.id, kind: 'consume', qty: -l.qty, unitCost: p.avgCost, bookingId: booking.id, staffId, note: '' });
  }
  return links.length;
}
