// Editable message templates. Overrides live in site_settings as msg.<key>.<lang>; defaults below.
// Placeholders: {name} {service} {when} {reason} {offer} {discount} {link} {brand}. Text inside [[ ]] is dropped when a placeholder inside it is empty.
export type TemplateDef = { key: string; titleAr: string; titleEn: string; ar: string; en: string; vars: string[] };
export const TEMPLATES: TemplateDef[] = [
  { key: 'booking_confirmed', titleAr: 'تأكيد الحجز', titleEn: 'Booking confirmed', vars: ['name', 'service', 'when'],
    ar: 'أهلًا {name}، تم تأكيد حجزك: {service} يوم {when}. بانتظارك!', en: 'Hi {name}, your booking is confirmed: {service} on {when}. See you soon!' },
  { key: 'deposit_rejected', titleAr: 'رفض إثبات العربون', titleEn: 'Deposit proof rejected', vars: ['name', 'reason', 'link'],
    ar: 'أهلًا {name}، لم نتمكن من اعتماد إثبات العربون[[ ({reason})]]. ارفعي الإثبات مرة أخرى من صفحة حجزك: {link}', en: 'Hi {name}, we could not accept your deposit proof[[ ({reason})]]. Please upload it again from your booking page: {link}' },
  { key: 'booking_cancelled', titleAr: 'إلغاء الحجز', titleEn: 'Booking cancelled', vars: ['name', 'service', 'when', 'reason'],
    ar: 'أهلًا {name}، تم إلغاء حجزك: {service} يوم {when}.[[ السبب: {reason}.]] تواصلي معنا لإعادة الحجز.', en: 'Hi {name}, your booking was cancelled: {service} on {when}.[[ Reason: {reason}.]] Contact us to rebook.' },
  { key: 'booking_rescheduled', titleAr: 'تغيير الموعد', titleEn: 'Booking rescheduled', vars: ['name', 'service', 'when'],
    ar: 'أهلًا {name}، تم تغيير موعد حجزك ({service}) إلى {when}.', en: 'Hi {name}, your booking ({service}) was moved to {when}.' },
  { key: 'recommendation', titleAr: 'توصيات العناية', titleEn: 'Care recommendations', vars: ['name', 'service', 'link'],
    ar: 'أهلًا {name}، أضافت الأخصائية توصيات العناية لجلستك ({service}). اطلعي عليها: {link}', en: 'Hi {name}, your specialist added care recommendations for {service}. See them here: {link}' },
  { key: 'appt_reminder', titleAr: 'تذكير بموعد قريب', titleEn: 'Upcoming appointment reminder', vars: ['name', 'service', 'when'],
    ar: 'أهلًا {name}، نذكّرك بموعدك: {service} يوم {when}. بانتظارك في {brand}.', en: 'Hi {name}, a reminder of your appointment: {service} on {when}. See you at {brand}.' },
  { key: 'routine_reminder', titleAr: 'تذكير الجلسة الدورية', titleEn: 'Routine session reminder', vars: ['name', 'link', 'brand'],
    ar: 'أهلًا {name}، حان موعد جلستك الدورية في {brand}. احجزي الآن: {link}', en: 'Hi {name}, it is time for your routine session at {brand}. Book now: {link}' },
  { key: 'offer_announce', titleAr: 'إعلان عرض', titleEn: 'Offer announcement', vars: ['name', 'offer', 'discount', 'link', 'brand'],
    ar: 'أهلًا {name}، عرض جديد من {brand}: {offer} ({discount}). احجزي من هنا: {link}', en: 'Hi {name}, a new offer from {brand}: {offer} ({discount}). Book here: {link}' },
];
export const getTemplate = (key: string) => TEMPLATES.find(t => t.key === key);
export function renderTemplate(settings: Record<string, string>, key: string, lang: 'ar' | 'en', vars: Record<string, string>) {
  const def = getTemplate(key); const raw = (settings[`msg.${key}.${lang}`] || def?.[lang] || '');
  const sub = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  return raw.replace(/\[\[([\s\S]*?)\]\]/g, (_, seg: string) => ((seg.match(/\{(\w+)\}/g) ?? []).every(p => (vars[p.slice(1, -1)] ?? '') !== '') ? sub(seg) : '')).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '').replace(/ +/g, ' ').trim();
}
