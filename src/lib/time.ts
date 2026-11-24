// All clinic times are interpreted in one timezone (default Africa/Cairo, DST-aware) and stored as UTC instants.
const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
export type DayKey = (typeof DAY_KEYS)[number];

function offsetMin(utcMs: number, tz: string): number {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000) / 60000;
}
export function zonedToUtc(dateStr: string, minutes: number, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = naive - offsetMin(naive, tz) * 60000;
  guess = naive - offsetMin(guess, tz) * 60000;
  return new Date(guess);
}
export const todayIn = (tz: string, now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
export function addDays(dateStr: string, n: number): string { const d = new Date(dateStr + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export const dayKey = (dateStr: string): DayKey => DAY_KEYS[new Date(dateStr + 'T12:00:00Z').getUTCDay()];
export const hhmmToMin = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0); };
export const minToHhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
export const isDateStr = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
export function fmtDateTime(d: Date | string, lang: 'ar' | 'en', tz: string) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: tz, dateStyle: 'full', timeStyle: 'short' }).format(new Date(d));
}
export function fmtDate(d: Date | string, lang: 'ar' | 'en', tz: string) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: tz, dateStyle: 'full' }).format(new Date(d));
}
export function fmtTime(d: Date | string, lang: 'ar' | 'en', tz: string) {
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { timeZone: tz, timeStyle: 'short' }).format(new Date(d));
}
