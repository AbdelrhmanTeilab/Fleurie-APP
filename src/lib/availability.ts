import { and, eq, gt, inArray, lt, ne, or } from 'drizzle-orm';
import { schema as s } from '@/db';
import { addDays, dayKey, hhmmToMin, isDateStr, minToHhmm, todayIn, zonedToUtc } from './time';

export const ACTIVE = ['pending_deposit', 'pending_confirmation', 'confirmed', 'completed'];
export type BookingSettings = { tz: string; step: number; lead: number; maxDays: number; holdMin: number; cancelHours: number; depositDefault: number };
export function bookingSettings(S: Record<string, string>): BookingSettings {
  const n = (k: string, d: number) => { const v = Number(S[k]); return Number.isFinite(v) && v > 0 ? v : d; };
  return { tz: S['booking.timezone'] || 'Africa/Cairo', step: n('booking.slot_step', 30), lead: n('booking.lead_minutes', 60), maxDays: n('booking.max_days', 60), holdMin: n('booking.hold_minutes', 120), cancelHours: n('booking.cancel_hours', 24), depositDefault: Number(S['booking.deposit_percent_default']) || 0 };
}

// Unpaid holds that ran out are released so the slot becomes bookable again.
export async function expireHolds(q: any) {
  await q.update(s.bookings).set({ status: 'cancelled', cancelReason: 'hold_expired', cancelledBy: 'system', cancelledAt: new Date() })
    .where(and(eq(s.bookings.status, 'pending_deposit'), lt(s.bookings.holdExpiresAt, new Date())));
}

type Slot = { time: string; startsAt: Date; staffIds: number[] };
// Returns every bookable start time on `date` for this service, with the staff members free at that time (best first).
export async function findSlots(q: any, service: { categoryId: number; durationMin: number }, date: string, cfg: BookingSettings, opts: { ignoreBookingId?: number } = {}): Promise<Slot[]> {
  if (!isDateStr(date)) return [];
  const today = todayIn(cfg.tz);
  if (date < today || date > addDays(today, cfg.maxDays)) return [];
  const qualified = await q.select({ id: s.staff.id, hours: s.staff.workingHours, priority: s.staffCategories.priority })
    .from(s.staff).innerJoin(s.staffCategories, eq(s.staffCategories.staffId, s.staff.id))
    .where(and(eq(s.staff.active, true), eq(s.staffCategories.categoryId, service.categoryId)));
  if (!qualified.length) return [];
  const ids = qualified.map((x: any) => x.id);
  const dayStart = zonedToUtc(date, 0, cfg.tz), dayEnd = zonedToUtc(addDays(date, 1), 0, cfg.tz);
  const busyB = await q.select({ staffId: s.bookings.staffId, a: s.bookings.startsAt, b: s.bookings.endsAt }).from(s.bookings)
    .where(and(inArray(s.bookings.staffId, ids), inArray(s.bookings.status, ACTIVE), lt(s.bookings.startsAt, dayEnd), gt(s.bookings.endsAt, dayStart), opts.ignoreBookingId ? ne(s.bookings.id, opts.ignoreBookingId) : undefined));
  const off = await q.select({ staffId: s.staffTimeOff.staffId, a: s.staffTimeOff.startsAt, b: s.staffTimeOff.endsAt }).from(s.staffTimeOff)
    .where(and(inArray(s.staffTimeOff.staffId, ids), lt(s.staffTimeOff.startsAt, dayEnd), gt(s.staffTimeOff.endsAt, dayStart)));
  const busy = [...busyB, ...off].map((x: any) => ({ staffId: x.staffId as number, a: +new Date(x.a), b: +new Date(x.b) }));
  const load = (id: number) => busyB.filter((x: any) => x.staffId === id).length;
  const minStart = Date.now() + cfg.lead * 60000;
  const map = new Map<string, Slot>();
  for (const st of qualified) {
    const wh = (st.hours as any)?.[dayKey(date)]; if (!wh) continue;
    const from = hhmmToMin(wh.from), to = hhmmToMin(wh.to);
    for (let m = from; m + service.durationMin <= to; m += cfg.step) {
      const a = zonedToUtc(date, m, cfg.tz), b = +a + service.durationMin * 60000;
      if (+a < minStart) continue;
      if (busy.some(x => x.staffId === st.id && x.a < b && x.b > +a)) continue;
      const key = minToHhmm(m); const slot = map.get(key) ?? { time: key, startsAt: a, staffIds: [] };
      slot.staffIds.push(st.id); map.set(key, slot);
    }
  }
  const prio = new Map<number, number>(qualified.map((x: any) => [x.id, x.priority]));
  return [...map.values()].map(sl => ({ ...sl, staffIds: sl.staffIds.sort((x, y) => (prio.get(x)! - prio.get(y)!) || (load(x) - load(y)) || x - y) })).sort((x, y) => x.time.localeCompare(y.time));
}
export { or };
