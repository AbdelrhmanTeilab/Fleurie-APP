import { and, eq, gt, inArray, like } from 'drizzle-orm';
import { schema as s } from '@/db';
import { addDays, fmtDateTime, todayIn } from './time';
import { dayOf } from './report';
import { notifyTemplate } from './notifyCustomer';
import { bookingSettings } from './availability';

// Idempotent: safe to call as often as you like (every hour from a cron). Each reminder is recorded in the outbox and never repeated for the same cycle/appointment.
export async function runReminders(db: any, settings: Record<string, string>) {
  const cfg = bookingSettings(settings), today = todayIn(cfg.tz), now = new Date();
  const out = { routine: 0, appointments: 0 };

  // 1) Appointment reminders: confirmed bookings starting within the next 24 hours.
  const soon = await db.select().from(s.bookings).where(and(eq(s.bookings.status, 'confirmed'), gt(s.bookings.startsAt, now)));
  for (const b of soon) {
    if (+b.startsAt - +now > 24 * 3600e3) continue;
    const done = await db.select({ id: s.notifications.id }).from(s.notifications).where(eq(s.notifications.template, `appt_reminder:${b.id}`));
    if (done.length) continue;
    await notifyTemplate(b.customerId, 'appt_reminder', l => ({ service: l === 'ar' ? b.serviceNameAr : b.serviceNameEn, when: fmtDateTime(b.startsAt, l, cfg.tz) }), b.id); out.appointments++;
  }

  // 2) Routine reminders: customer opted in, last completed session (or declared first session) + reminderDay has passed, nothing booked ahead, not reminded since.
  const custs = await db.select().from(s.customers).where(and(eq(s.customers.status, 'active'), eq(s.customers.reminderEnabled, true)));
  const live = await db.select().from(s.bookings).where(inArray(s.bookings.status, ['pending_deposit', 'pending_confirmation', 'confirmed']));
  const completed = await db.select().from(s.bookings).where(eq(s.bookings.status, 'completed'));
  for (const c of custs) {
    if (live.some((b: any) => b.customerId === c.id && +b.startsAt > +now)) continue;
    const mine = completed.filter((b: any) => b.customerId === c.id).map((b: any) => dayOf(b.completedAt ?? b.startsAt, cfg.tz)).sort();
    const last = mine.length ? mine[mine.length - 1] : (c.firstSessionDate ?? null);
    if (!last || addDays(last, c.reminderDay) > today) continue;
    const sent = await db.select({ d: s.notifications.createdAt }).from(s.notifications).where(and(eq(s.notifications.customerId, c.id), eq(s.notifications.template, 'routine_reminder')));
    if (sent.some((x: any) => dayOf(x.d, cfg.tz) >= last)) continue;
    await notifyTemplate(c.id, 'routine_reminder', () => ({})); out.routine++;
  }
  return out;
}

// Sends an offer announcement once per customer to those who opted in to messages.
export async function announceOffer(db: any, settings: Record<string, string>, offerId: number) {
  const [o] = await db.select().from(s.offers).where(eq(s.offers.id, offerId)); if (!o) return { sent: 0, skipped: 0 };
  const custs = await db.select().from(s.customers).where(and(eq(s.customers.status, 'active'), eq(s.customers.reminderEnabled, true)));
  const prev = await db.select({ c: s.notifications.customerId }).from(s.notifications).where(like(s.notifications.template, `offer_announce:${offerId}`));
  const already = new Set(prev.map((x: any) => x.c)); let sent = 0, skipped = 0;
  for (const c of custs) {
    if (already.has(c.id)) { skipped++; continue; }
    await notifyTemplate(c.id, 'offer_announce', l => ({ offer: l === 'ar' ? o.nameAr : o.nameEn, discount: o.percent ? `${o.percent}%` : `${o.amountOff} ${l === 'ar' ? 'ج.م' : 'EGP'}`, link: `${(process.env.APP_URL || settings['site.url'] || 'http://127.0.0.1:3100').replace(/\/$/, '')}/offers` }), offerId); sent++;
  }
  return { sent, skipped };
}
