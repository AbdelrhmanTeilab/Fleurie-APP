import { cookies } from 'next/headers';
import { getDb, schema as s } from '@/db';
import { DEFAULT_LABELS } from './labels';
import { DEFAULT_SETTINGS } from '@/db/seed';

export type Lang = 'ar' | 'en';
export async function getLang(): Promise<Lang> { return (await cookies()).get('fl_lang')?.value === 'en' ? 'en' : 'ar'; }

export async function getSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select().from(s.siteSettings);
  return { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r: any) => [r.key, r.value])) };
}
export async function getOverrides(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.select().from(s.siteLabels);
  return Object.fromEntries(rows.map((r: any) => [`${r.lang}:${r.key}`, r.value]));
}
export async function getI18n() {
  const [lang, settings, over] = await Promise.all([getLang(), getSettings(), getOverrides()]);
  const t = (key: string) => over[`${lang}:${key}`] || DEFAULT_LABELS[key]?.[lang] || key;
  const brand = { name: settings[`brand.name_${lang}`], slogan: settings[`brand.slogan_${lang}`], logo: settings['brand.logo'] };
  return { lang, dir: lang === 'ar' ? 'rtl' : 'ltr', t, settings, brand };
}
