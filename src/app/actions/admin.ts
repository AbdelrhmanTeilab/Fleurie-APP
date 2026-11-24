'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { and, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { can, requireStaff, type StaffUser } from '@/lib/auth';
import { getI18n } from '@/lib/i18n';
import { bookingSettings, findSlots } from '@/lib/availability';
import { addDays, fmtDateTime, isDateStr, zonedToUtc } from '@/lib/time';
import { saveImage } from '@/lib/upload';
import { logAction } from '@/lib/audit';
import { consumeForBooking } from '@/lib/inventory';
import { notifyTemplate, siteUrl } from '@/lib/notifyCustomer';

type FormState = { error?: string; ok?: string } | undefined;
const str = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const int = (f: FormData, k: string, d = 0) => { const v = Math.round(Number(str(f, k))); return Number.isFinite(v) ? v : d; };
const actor = (u: StaffUser) => ({ kind: 'staff' as const, id: u.id, name: u.nameEn });
const LOCK = 7001;

async function ctx() { const { lang, settings } = await getI18n(); return { lang, cfg: bookingSettings(settings), m: (ar: string, en: string) => (lang === 'ar' ? ar : en) }; }
// Staff with only "own bookings" may touch just their own appointments.
async function loadBooking(u: StaffUser, id: number) {
  const db = await getDb();
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!b) return null;
  if (!can(u, 'bookings.all') && !(can(u, 'bookings.own') && b.staffId === u.id)) return null;
  return b;
}
const when = (b: any, lang: 'ar' | 'en', tz: string) => fmtDateTime(b.startsAt, lang, tz);
const nameOf = (b: any, l: 'ar' | 'en') => (l === 'ar' ? b.serviceNameAr : b.serviceNameEn);

export async function reviewPaymentAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('payments.manage'); const { cfg, m } = await ctx();
  const id = Number(str(f, 'paymentId')), approve = str(f, 'decision') === 'approve', reason = str(f, 'reason').slice(0, 300);
  const db = await getDb(); const [p] = await db.select().from(s.payments).where(eq(s.payments.id, id));
  if (!p || p.status !== 'submitted') return { error: m('تمت مراجعة هذا الإثبات من قبل', 'This proof was already reviewed') };
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, p.bookingId));
  if (approve && b.status === 'cancelled') return { error: m('الحجز ملغي. لا يمكن اعتماد العربون. سجّلي استرداد يدويًا.', 'The booking is cancelled, so the deposit cannot be approved. Handle the refund manually.') };
  await db.update(s.payments).set({ status: approve ? 'approved' : 'rejected', rejectReason: approve ? '' : reason, reviewedBy: u.id, reviewedAt: new Date() }).where(eq(s.payments.id, p.id));
  if (approve) {
    if (b.status === 'pending_confirmation' || b.status === 'pending_deposit') await db.update(s.bookings).set({ status: 'confirmed', holdExpiresAt: null }).where(eq(s.bookings.id, b.id));
    await notifyTemplate(b.customerId, 'booking_confirmed', l => ({ service: nameOf(b, l), when: when(b, l, cfg.tz) }));
  } else {
    if (b.status === 'pending_confirmation') await db.update(s.bookings).set({ status: 'pending_deposit', holdExpiresAt: new Date(Date.now() + cfg.holdMin * 60000) }).where(eq(s.bookings.id, b.id));
    await notifyTemplate(b.customerId, 'deposit_rejected', l => ({ reason, link: `${siteUrl()}/bookings/${b.id}` }));
  }
  await logAction(actor(u), approve ? 'payment.approve' : 'payment.reject', 'payment', p.id, { bookingId: b.id, amount: p.amount });
  revalidatePath(`/admin/bookings/${b.id}`); revalidatePath('/admin/bookings');
  return { ok: approve ? m('تم اعتماد العربون وتأكيد الحجز', 'Deposit approved and booking confirmed') : m('تم رفض الإثبات وإبلاغ العميلة', 'Proof rejected and the customer was told') };
}

export async function confirmBookingAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('bookings.all'); const { cfg, m } = await ctx();
  const db = await getDb(); const id = Number(str(f, 'bookingId'));
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!b || !['pending_confirmation', 'pending_deposit'].includes(b.status)) return { error: m('لا يمكن تأكيد هذا الحجز', 'This booking cannot be confirmed') };
  const sub = await db.select().from(s.payments).where(and(eq(s.payments.bookingId, id), eq(s.payments.status, 'submitted')));
  if (sub.length) return { error: m('راجعي إثبات العربون أولًا', 'Review the deposit proof first') };
  if (b.depositAmount > 0 && !can(u, 'payments.manage')) return { error: m('هذا الحجز عليه عربون ولم يُعتمد بعد', 'This booking has a deposit that is not approved yet') };
  await db.update(s.bookings).set({ status: 'confirmed', holdExpiresAt: null }).where(eq(s.bookings.id, id));
  await notifyTemplate(b.customerId, 'booking_confirmed', l => ({ service: nameOf(b, l), when: when(b, l, cfg.tz) }));
  await logAction(actor(u), 'booking.confirm', 'booking', id);
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: m('تم التأكيد', 'Confirmed') };
}

export async function staffCancelBookingAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('bookings.all'); const { cfg, m } = await ctx();
  const db = await getDb(); const id = Number(str(f, 'bookingId')), reason = str(f, 'reason').slice(0, 300);
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!b || !['pending_deposit', 'pending_confirmation', 'confirmed'].includes(b.status)) return { error: m('لا يمكن إلغاء هذا الحجز', 'This booking cannot be cancelled') };
  await db.update(s.bookings).set({ status: 'cancelled', cancelledBy: 'staff', cancelReason: reason, cancelledAt: new Date() }).where(eq(s.bookings.id, id));
  await notifyTemplate(b.customerId, 'booking_cancelled', l => ({ service: nameOf(b, l), when: when(b, l, cfg.tz), reason }));
  await logAction(actor(u), 'booking.cancel', 'booking', id, { reason });
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: m('تم الإلغاء. إن كان هناك عربون مدفوع فأعيديه يدويًا ثم سجّلي الاسترداد.', 'Cancelled. If a deposit was paid, refund it by hand and record the refund.') };
}

export async function rescheduleAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('bookings.all'); const { cfg, lang, m } = await ctx();
  const id = Number(str(f, 'bookingId')), date = str(f, 'date'), time = str(f, 'time');
  if (!isDateStr(date) || !/^\d{2}:\d{2}$/.test(time)) return { error: m('اختاري تاريخًا ووقتًا', 'Choose a date and time') };
  const db = await getDb(); let err: string | undefined; let nb: any;
  await db.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${LOCK})`);
    const [b] = await tx.select().from(s.bookings).where(eq(s.bookings.id, id));
    if (!b || !['pending_deposit', 'pending_confirmation', 'confirmed'].includes(b.status)) { err = m('لا يمكن تغيير موعد هذا الحجز', 'This booking cannot be rescheduled'); return; }
    const [svc] = await tx.select().from(s.services).where(eq(s.services.id, b.serviceId));
    const slot = (await findSlots(tx, svc, date, cfg, { ignoreBookingId: b.id })).find(x => x.time === time);
    if (!slot) { err = m('هذا الموعد غير متاح', 'That time is not available'); return; }
    const staffId = slot.staffIds.includes(b.staffId) ? b.staffId : slot.staffIds[0];
    [nb] = await tx.update(s.bookings).set({ startsAt: slot.startsAt, endsAt: new Date(+slot.startsAt + svc.durationMin * 60000), staffId }).where(eq(s.bookings.id, id)).returning();
  });
  if (err) return { error: err };
  await notifyTemplate(nb.customerId, 'booking_rescheduled', l => ({ service: nameOf(nb, l), when: when(nb, l, cfg.tz) }));
  await logAction(actor(u), 'booking.reschedule', 'booking', id, { date, time });
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: m('تم تغيير الموعد وإبلاغ العميلة', 'Rescheduled and the customer was told') };
}

export async function completeBookingAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff(); const { m } = await ctx();
  const id = Number(str(f, 'bookingId')); const b = await loadBooking(u, id);
  if (!b) return { error: m('الحجز غير موجود', 'Booking not found') };
  if (b.status !== 'confirmed') return { error: m('يجب أن يكون الحجز مؤكدًا أولًا', 'The booking must be confirmed first') };
  const db = await getDb();
  await db.update(s.bookings).set({ status: 'completed', completedAt: new Date() }).where(eq(s.bookings.id, id));
  await consumeForBooking(db, b, u.id);
  await logAction(actor(u), 'booking.complete', 'booking', id);
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: m('تم تسجيل الجلسة كمكتملة', 'Marked as completed') };
}

// Money received at the clinic (balance) or paid back (refund). Only approved rows count as revenue.
export async function recordPaymentAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('payments.manage'); const { m } = await ctx();
  const id = Number(str(f, 'bookingId')), amount = int(f, 'amount'), kind = str(f, 'kind') === 'refund' ? 'refund' : 'balance';
  const method = str(f, 'method').slice(0, 60) || 'cash';
  if (amount <= 0 || amount > 1_000_000) return { error: m('المبلغ غير صحيح', 'Invalid amount') };
  const db = await getDb(); const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!b) return { error: m('الحجز غير موجود', 'Booking not found') };
  const pays = await db.select().from(s.payments).where(and(eq(s.payments.bookingId, id), eq(s.payments.status, 'approved')));
  const paid = pays.filter((p: any) => p.kind !== 'refund').reduce((a: number, p: any) => a + p.amount, 0), refunded = pays.filter((p: any) => p.kind === 'refund').reduce((a: number, p: any) => a + p.amount, 0);
  if (kind === 'balance' && paid - refunded + amount > b.price) return { error: m('المبلغ يتجاوز سعر الجلسة', 'This exceeds the session price') };
  if (kind === 'refund' && amount > paid - refunded) return { error: m('الاسترداد أكبر من المدفوع', 'Refund is more than what was paid') };
  await db.insert(s.payments).values({ bookingId: id, customerId: b.customerId, kind, amount, method, reference: str(f, 'reference').slice(0, 120), status: 'approved', reviewedBy: u.id, reviewedAt: new Date() });
  await logAction(actor(u), `payment.${kind}`, 'booking', id, { amount, method });
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: m('تم تسجيل الدفعة', 'Payment recorded') };
}

export async function saveRecommendationAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('recommendations.write'); const { m } = await ctx();
  const id = Number(str(f, 'bookingId')); const b = await loadBooking(u, id);
  if (!b) return { error: m('الحجز غير موجود', 'Booking not found') };
  if (!['confirmed', 'completed'].includes(b.status)) return { error: m('التوصيات بعد تأكيد الحجز', 'Recommendations can be written once the booking is confirmed') };
  const v = { aftercare: str(f, 'aftercare').slice(0, 3000), productsRecommended: str(f, 'productsRecommended').slice(0, 3000), usageInstructions: str(f, 'usageInstructions').slice(0, 3000), productsToAvoid: str(f, 'productsToAvoid').slice(0, 3000), nextPrep: str(f, 'nextPrep').slice(0, 3000) };
  const db = await getDb(); const [ex] = await db.select().from(s.recommendations).where(eq(s.recommendations.bookingId, id));
  if (ex) await db.update(s.recommendations).set({ ...v, staffId: u.id, updatedAt: new Date() }).where(eq(s.recommendations.id, ex.id));
  else await db.insert(s.recommendations).values({ bookingId: id, staffId: u.id, ...v });
  await notifyTemplate(b.customerId, 'recommendation', l => ({ service: nameOf(b, l), link: `${siteUrl()}/bookings/${b.id}` }));
  await logAction(actor(u), 'recommendation.save', 'booking', id);
  revalidatePath(`/admin/bookings/${id}`);
  return { ok: m('تم حفظ التوصيات', 'Recommendations saved') };
}

// ---------- catalogue ----------
export async function saveServiceAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('services.manage'); const { m } = await ctx();
  const id = Number(str(f, 'id')) || 0;
  const dep = str(f, 'depositPercent');
  const v = { categoryId: int(f, 'categoryId'), nameAr: str(f, 'nameAr').slice(0, 120), nameEn: str(f, 'nameEn').slice(0, 120), descAr: str(f, 'descAr').slice(0, 800), descEn: str(f, 'descEn').slice(0, 800),
    durationMin: int(f, 'durationMin', 60), price: int(f, 'price', -1), depositPercent: dep === '' ? null : int(f, 'depositPercent'), sort: int(f, 'sort'), active: f.get('active') === 'on' };
  if (!v.nameAr || !v.nameEn || !v.categoryId) return { error: m('أدخلي الاسم بالعربية والإنجليزية والقسم', 'Enter the Arabic and English names and the category') };
  if (v.price < 0 || v.price > 1_000_000 || v.durationMin < 10 || v.durationMin > 600) return { error: m('تأكدي من السعر والمدة', 'Check the price and the duration') };
  if (v.depositPercent !== null && (v.depositPercent < 0 || v.depositPercent > 100)) return { error: m('نسبة العربون من 0 إلى 100', 'Deposit must be between 0 and 100') };
  const img = await saveImage(f.get('image') as File | null);
  if (img.error) return { error: img.error === 'size' ? m('الصورة أكبر من 3 ميجا', 'Image is larger than 3 MB') : m('الصورة يجب أن تكون PNG أو JPG أو WEBP', 'Image must be PNG, JPG or WEBP') };
  const db = await getDb(); const set: any = { ...v }; if (img.name) set.image = img.name; if (f.get('removeImage') === 'on') set.image = null;
  if (id) await db.update(s.services).set(set).where(eq(s.services.id, id)); else await db.insert(s.services).values(set);
  await logAction(actor(u), id ? 'service.update' : 'service.create', 'service', id || v.nameEn);
  revalidatePath('/admin/services'); revalidatePath('/sessions');
  return { ok: m('تم الحفظ', 'Saved') };
}

export async function saveOfferAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('services.manage'); const { m } = await ctx();
  const id = Number(str(f, 'id')) || 0, start = str(f, 'startDate'), end = str(f, 'endDate');
  const v = { nameAr: str(f, 'nameAr').slice(0, 120), nameEn: str(f, 'nameEn').slice(0, 120), descAr: str(f, 'descAr').slice(0, 600), descEn: str(f, 'descEn').slice(0, 600), percent: int(f, 'percent'), amountOff: int(f, 'amountOff'),
    startDate: start && isDateStr(start) ? start : null, endDate: end && isDateStr(end) ? end : null, active: f.get('active') === 'on' };
  if (!v.nameAr || !v.nameEn) return { error: m('أدخلي اسم العرض بالعربية والإنجليزية', 'Enter the offer name in Arabic and English') };
  if (v.percent < 0 || v.percent > 100 || v.amountOff < 0 || (v.percent === 0 && v.amountOff === 0)) return { error: m('أدخلي نسبة خصم أو مبلغ خصم صحيح', 'Enter a valid percentage or amount off') };
  if (v.startDate && v.endDate && v.endDate < v.startDate) return { error: m('تاريخ النهاية قبل البداية', 'End date is before start date') };
  const ids = f.getAll('serviceIds').map(Number).filter(Boolean);
  const db = await getDb(); let oid = id;
  if (id) await db.update(s.offers).set(v).where(eq(s.offers.id, id)); else [{ id: oid }] = await db.insert(s.offers).values(v).returning({ id: s.offers.id });
  await db.delete(s.offerServices).where(eq(s.offerServices.offerId, oid));
  if (ids.length) await db.insert(s.offerServices).values(ids.map(serviceId => ({ offerId: oid, serviceId })));
  await logAction(actor(u), id ? 'offer.update' : 'offer.create', 'offer', oid);
  revalidatePath('/admin/offers'); revalidatePath('/offers'); revalidatePath('/sessions');
  return { ok: m('تم الحفظ', 'Saved') };
}
export async function deleteOfferAction(f: FormData) {
  const u = await requireStaff('services.manage'); const id = Number(str(f, 'id')); const db = await getDb();
  await db.delete(s.offerServices).where(eq(s.offerServices.offerId, id)); await db.delete(s.offers).where(eq(s.offers.id, id));
  await logAction(actor(u), 'offer.delete', 'offer', id); revalidatePath('/admin/offers'); redirect('/admin/offers');
}

// ---------- staff time off ----------
export async function addTimeOffAction(_: FormState, f: FormData): Promise<FormState> {
  const u = await requireStaff('staff.manage'); const { cfg, m } = await ctx();
  const staffId = Number(str(f, 'staffId')), from = str(f, 'from'), to = str(f, 'to') || from;
  if (!staffId || !isDateStr(from) || !isDateStr(to) || to < from) return { error: m('تأكدي من التواريخ', 'Check the dates') };
  const a = zonedToUtc(from, 0, cfg.tz), b = zonedToUtc(addDays(to, 1), 0, cfg.tz);
  const db = await getDb();
  const clash = await db.select().from(s.bookings).where(and(eq(s.bookings.staffId, staffId), lt(s.bookings.startsAt, b), gt(s.bookings.endsAt, a), inArray(s.bookings.status, ['pending_deposit', 'pending_confirmation', 'confirmed'])));
  await db.insert(s.staffTimeOff).values({ staffId, startsAt: a, endsAt: b, reason: str(f, 'reason').slice(0, 200) });
  await logAction(actor(u), 'timeoff.add', 'staff', staffId, { from, to });
  revalidatePath('/admin/schedule');
  return { ok: clash.length ? m(`تم الحفظ، لكن يوجد ${clash.length} حجز في هذه الفترة. عدّلي مواعيدها من صفحة الحجوزات.`, `Saved, but ${clash.length} booking(s) fall in this period. Reschedule them from Bookings.`) : m('تم تسجيل الإجازة', 'Time off saved') };
}
export async function deleteTimeOffAction(f: FormData) {
  const u = await requireStaff('staff.manage'); const id = Number(str(f, 'id')); const db = await getDb();
  await db.delete(s.staffTimeOff).where(eq(s.staffTimeOff.id, id)); await logAction(actor(u), 'timeoff.delete', 'staff_time_off', id); revalidatePath('/admin/schedule');
}
