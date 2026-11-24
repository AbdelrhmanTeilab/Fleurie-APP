import { eq } from 'drizzle-orm';
import { schema as s } from '@/db';

export type OfferRow = { id: number; nameAr: string; nameEn: string; descAr: string; descEn: string; percent: number; amountOff: number; startDate: string | null; endDate: string | null; active: boolean; serviceIds: number[] };

export async function loadOffers(db: any, today: string): Promise<OfferRow[]> {
  const rows = await db.select().from(s.offers).where(eq(s.offers.active, true));
  const links = await db.select().from(s.offerServices);
  return rows.filter((o: any) => (!o.startDate || o.startDate <= today) && (!o.endDate || o.endDate >= today))
    .map((o: any) => ({ ...o, serviceIds: links.filter((l: any) => l.offerId === o.id).map((l: any) => l.serviceId) }));
}
export function priceFor(service: { id: number; price: number }, offers: OfferRow[]) {
  let best: { offer: OfferRow | null; price: number } = { offer: null, price: service.price };
  for (const o of offers) {
    if (o.serviceIds.length && !o.serviceIds.includes(service.id)) continue; // no linked services = applies to all
    const p = Math.max(0, Math.round(service.price - (service.price * o.percent) / 100 - o.amountOff));
    if (p < best.price) best = { offer: o, price: p };
  }
  return { listPrice: service.price, price: best.price, discount: service.price - best.price, offer: best.offer };
}
export const depositFor = (finalPrice: number, percent: number) => Math.min(finalPrice, Math.ceil((finalPrice * percent) / 100));
