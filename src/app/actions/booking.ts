'use server';
import { tooMany } from '@/lib/ratelimit';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { requireCustomer } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, expireHolds, findSlots } from '@/lib/availability';
import { depositFor, loadOffers, priceFor } from '@/lib/pricing';
import { isDateStr, todayIn } from '@/lib/time';
import { saveImage } from '@/lib/upload';
import { logAction } from '@/lib/audit';

type FormState = { error?: string; ok?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const LOCK = 7001; // one clinic: a single lock serialises booking writes, which rules out double-booking

export async function createBookingAction(_: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer(); const { lang, t, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  if (tooMany(`book:${c.id}`, 15, 3600e3)) return { error: m('طلبات حجز كثيرة. حاولي لاحقًا.', 'Too many booking attempts. Please try again later.') };
  const serviceId = Number(str(f, 'serviceId')), date = str(f, 'date'), time = str(f, 'time'), note = str(f, 'note').slice(0, 500);
  if (!serviceId || !isDateStr(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: m('اختاري اليوم والموعد', 'Please choose a day and a time') };
  const cfg = bookingSettings(settings);
  const db = await getDb();
  let newId = 0; let err: string | undefined;
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK})`);
    await expireHolds(tx);
    const [svc] = await tx.select().from(s.services).where(and(eq(s.services.id, serviceId), eq(s.services.active, true)));
    if (!svc) { err = m('هذه الجلسة غير متاحة', 'This session is not available'); return; }
    const pendingN = (await tx.select({ id: s.bookings.id }).from(s.bookings).where(and(eq(s.bookings.customerId, c.id), eq(s.bookings.status, 'pending_deposit')))).length;
    if (pendingN >= 3) { err = m('لديك حجوزات كثيرة بانتظار العربون. أكملي دفعها أو ألغيها أولًا.', 'You have several bookings waiting for a deposit. Pay or cancel them first.'); return; }
    const slot = (await findSlots(tx, svc, date, cfg)).find(x => x.time === time);
    if (!slot) { err = t('book.slot_taken'); return; }
    const staffId = slot.staffIds[0];
    const offers = await loadOffers(tx, todayIn(cfg.tz));
    const p = priceFor(svc, offers);
    const pct = svc.depositPercent ?? cfg.depositDefault;
    const deposit = depositFor(p.price, pct);
    const [b] = await tx.insert(s.bookings).values({
      customerId: c.id, serviceId: svc.id, staffId, serviceNameAr: svc.nameAr, serviceNameEn: svc.nameEn,
      startsAt: slot.startsAt, endsAt: new Date(+slot.startsAt + svc.durationMin * 60000),
      listPrice: p.listPrice, discountAmount: p.discount, price: p.price, offerId: p.offer?.id ?? null, offerName: p.offer ? p.offer.nameAr : '',
      depositPercent: pct, depositAmount: deposit, status: deposit > 0 ? 'pending_deposit' : 'pending_confirmation',
      holdExpiresAt: deposit > 0 ? new Date(Date.now() + cfg.holdMin * 60000) : null, customerNote: note,
    }).returning();
    newId = b.id;
  });
  if (err) return { error: err };
  await logAction({ kind: 'customer', id: c.id, name: c.name }, 'booking.create', 'booking', newId);
  revalidatePath('/bookings');
  redirect(`/bookings/${newId}`);
}

export async function submitProofAction(_: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer(); const { lang } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const id = Number(str(f, 'bookingId')), method = str(f, 'method').slice(0, 60), reference = str(f, 'reference').slice(0, 120);
  const file = f.get('proof') as File | null;
  if (!file || !file.size) return { error: m('ارفعي صورة إثبات التحويل', 'Please upload the proof image') };
  if (!reference) return { error: m('اكتبي رقم العملية', 'Enter the transaction reference') };
  const db = await getDb();
  await expireHolds(db);
  const [b] = await db.select().from(s.bookings).where(and(eq(s.bookings.id, id), eq(s.bookings.customerId, c.id)));
  if (!b) return { error: m('الحجز غير موجود', 'Booking not found') };
  if (b.status !== 'pending_deposit') return { error: b.status === 'cancelled' ? m('انتهت مهلة الحجز. احجزي من جديد.', 'The hold has expired. Please book again.') : m('لا يمكن إرسال إثبات لهذا الحجز الآن', 'You cannot submit proof for this booking now') };
  const img = await saveImage(file, 4 * 1024 * 1024, true);
  if (img.error) return { error: img.error === 'size' ? m('الصورة أكبر من 4 ميجا', 'Image is larger than 4 MB') : m('الملف يجب أن يكون صورة PNG أو JPG أو WEBP', 'File must be a PNG, JPG or WEBP image') };
  await db.insert(s.payments).values({ bookingId: b.id, customerId: c.id, kind: 'deposit', amount: b.depositAmount, method, reference, proofFile: img.name, status: 'submitted' });
  await db.update(s.bookings).set({ status: 'pending_confirmation', holdExpiresAt: null }).where(eq(s.bookings.id, b.id));
  await logAction({ kind: 'customer', id: c.id, name: c.name }, 'payment.submit', 'booking', b.id, { amount: b.depositAmount });
  revalidatePath(`/bookings/${b.id}`);
  return { ok: m('تم استلام الإثبات وجارٍ مراجعته', 'Proof received. We are reviewing it.') };
}

export async function cancelBookingAction(_: FormState, f: FormData): Promise<FormState> {
  const c = await requireCustomer(); const { lang, t, settings } = await getI18n(); const m = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const id = Number(str(f, 'bookingId')); const cfg = bookingSettings(settings);
  const db = await getDb();
  const [b] = await db.select().from(s.bookings).where(and(eq(s.bookings.id, id), eq(s.bookings.customerId, c.id)));
  if (!b || !['pending_deposit', 'pending_confirmation', 'confirmed'].includes(b.status)) return { error: m('لا يمكن إلغاء هذا الحجز', 'This booking cannot be cancelled') };
  const paid = b.status !== 'pending_deposit';
  if (paid && +b.startsAt - Date.now() < cfg.cancelHours * 3600000) return { error: t('book.cancel_late').replace('{h}', String(cfg.cancelHours)) };
  await db.update(s.bookings).set({ status: 'cancelled', cancelledBy: 'customer', cancelReason: str(f, 'reason').slice(0, 300), cancelledAt: new Date() }).where(eq(s.bookings.id, b.id));
  await logAction({ kind: 'customer', id: c.id, name: c.name }, 'booking.cancel', 'booking', b.id);
  revalidatePath('/bookings');
  redirect('/bookings');
}
