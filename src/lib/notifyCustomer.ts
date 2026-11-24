import { eq } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';
import { getSettings } from './i18n';
import { sendNotification } from './notify';
import { renderTemplate } from './templates';

export const siteUrl = (settings?: Record<string, string>) => (process.env.APP_URL || settings?.['site.url'] || 'http://127.0.0.1:3100').replace(/\/$/, '');

// Renders an (editable) template in the customer's own language and sends it through their preferred channel.
// `ref` lets callers de-duplicate (stored as template "<key>:<ref>").
export async function notifyTemplate(customerId: number, key: string, vars: (lang: 'ar' | 'en') => Record<string, string>, ref?: string | number) {
  const db = await getDb(); const settings = await getSettings();
  const [c] = await db.select().from(s.customers).where(eq(s.customers.id, customerId)); if (!c) return 'skipped';
  const lang = c.language === 'en' ? 'en' : 'ar', channel = c.reminderChannel === 'email' ? 'email' : 'whatsapp';
  const v = { name: c.name, brand: settings[`brand.name_${lang}`] ?? 'Fleurie', link: siteUrl(settings), ...vars(lang) };
  try {
    return await sendNotification({ customerId, channel, to: channel === 'email' ? c.email : c.whatsapp, template: ref !== undefined ? `${key}:${ref}` : key, body: renderTemplate(settings, key, lang, v), subject: v.brand });
  } catch (e) { console.error('[notify] failed', e); return 'failed'; }
}
