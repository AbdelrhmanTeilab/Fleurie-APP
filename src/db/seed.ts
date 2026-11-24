import fs from 'node:fs';
import path from 'node:path';
import { schema as s } from './index';
import { DEFAULT_ROLES } from '../lib/permissions';
import { hashPassword, randomPassword } from '../lib/crypto';
import { eq } from 'drizzle-orm';

export const DEFAULT_SETTINGS: Record<string, string> = {
  'brand.name_ar': 'فلوري', 'brand.name_en': 'Fleurie',
  'brand.slogan_ar': 'صالون الجمال', 'brand.slogan_en': 'Beauty Lounge',
  'brand.logo': '', 'brand.phone': '', 'brand.address_ar': '', 'brand.address_en': '',
  'theme.primary': '#9a6b5f', 'theme.accent': '#c6a46c', 'theme.bg': '#faf6f2', 'theme.surface': '#ffffff', 'theme.text': '#2e2623',
  'payment.instructions_ar': 'حوّل العربون على فودافون كاش / انستاباي ثم ارفع إثبات التحويل.',
  'payment.instructions_en': 'Transfer the deposit via Vodafone Cash / InstaPay, then upload the proof.',
  'booking.deposit_percent_default': '30', 'booking.timezone': 'Africa/Cairo', 'booking.slot_step': '30', 'booking.lead_minutes': '60',
  'booking.max_days': '60', 'booking.hold_minutes': '120', 'booking.cancel_hours': '24',
};

export async function seedIfEmpty(db: any) {
  const existing = await db.select().from(s.roles).limit(1);
  if (existing.length) return;

  for (const r of DEFAULT_ROLES) {
    const [row] = await db.insert(s.roles).values({ key: r.key, nameAr: r.ar, nameEn: r.en, system: r.key === 'full_admin' }).returning();
    await db.insert(s.rolePermissions).values(r.perms.map(p => ({ roleId: row.id, permission: p })));
  }
  await db.insert(s.siteSettings).values(Object.entries(DEFAULT_SETTINGS).map(([key, value]) => ({ key, value })));

  const cats = await db.insert(s.serviceCategories).values([
    { key: 'skincare', nameAr: 'العناية بالبشرة', nameEn: 'Skincare', sort: 1 },
    { key: 'hair', nameAr: 'الشعر', nameEn: 'Hair', sort: 2 },
  ]).returning();
  const cat = (k: string) => cats.find((c: any) => c.key === k).id;
  const role = async (k: string) => (await db.select().from(s.roles).where(eq(s.roles.key, k)))[0].id;

  const week = { sat: { from: '11:00', to: '19:00' }, sun: { from: '11:00', to: '19:00' }, mon: { from: '11:00', to: '19:00' }, tue: { from: '11:00', to: '19:00' }, wed: { from: '11:00', to: '19:00' }, thu: { from: '11:00', to: '19:00' }, fri: null };
  const pwShrouk = randomPassword(), pwNada = randomPassword();
  const [shrouk] = await db.insert(s.staff).values({ nameAr: 'شروق العرابي', nameEn: 'Shrouk El Oraby', email: 'shrouk@fleurie.local', passwordHash: hashPassword(pwShrouk), roleId: await role('full_admin'), workingHours: week }).returning();
  const [nada] = await db.insert(s.staff).values({ nameAr: 'ندى العرابي', nameEn: 'Nada El Oraby', email: 'nada@fleurie.local', passwordHash: hashPassword(pwNada), roleId: await role('specialist'), workingHours: week }).returning();
  await db.insert(s.staffCategories).values([
    { staffId: shrouk.id, categoryId: cat('skincare'), priority: 1 },
    { staffId: shrouk.id, categoryId: cat('hair'), priority: 2 }, // supports Nada when she is busy
    { staffId: nada.id, categoryId: cat('hair'), priority: 1 },
  ]);

  const dir = path.join(process.cwd(), '.data');
  const note = `Initial staff logins (change on first sign-in; delete this file afterwards)\n\nshrouk@fleurie.local  ${pwShrouk}\nnada@fleurie.local    ${pwNada}\n`;
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, 'initial-passwords.txt'), note); } catch {}
  console.log('\n[seed] ' + note.replace(/\n+/g, '\n[seed] ') + '\n');
}

// Starter catalogue so the site is not empty. Runs once; afterwards the admin owns the catalogue.
export async function seedCatalogueOnce(db: any) {
  const flag = await db.select().from(s.siteSettings).where(eq(s.siteSettings.key, 'seed.catalogue_v1'));
  if (flag.length) return;
  const cats = await db.select().from(s.serviceCategories);
  const cat = (k: string) => cats.find((c: any) => c.key === k)?.id;
  if (cat('skincare') && cat('hair')) {
    await db.insert(s.services).values([
      { categoryId: cat('skincare'), nameAr: 'تنظيف بشرة عميق', nameEn: 'Deep Facial Cleansing', descAr: 'تنظيف عميق مع تقشير لطيف وماسك مرطب', descEn: 'Deep cleansing with gentle exfoliation and a hydrating mask', durationMin: 60, price: 600, sort: 1 },
      { categoryId: cat('skincare'), nameAr: 'جلسة ترطيب وإشراقة', nameEn: 'Hydra Glow Session', descAr: 'ترطيب مكثف لبشرة مشرقة', descEn: 'Intense hydration for a radiant look', durationMin: 90, price: 900, sort: 2 },
      { categoryId: cat('hair'), nameAr: 'علاج الشعر بالبروتين', nameEn: 'Protein Hair Treatment', descAr: 'علاج لتقوية الشعر وإعادة اللمعان', descEn: 'Strengthening treatment that restores shine', durationMin: 120, price: 1200, sort: 1 },
      { categoryId: cat('hair'), nameAr: 'قص وتصفيف', nameEn: 'Cut & Style', descAr: 'قص احترافي مع تصفيف', descEn: 'Professional cut and styling', durationMin: 60, price: 400, sort: 2 },
    ]);
  }
  await db.insert(s.siteSettings).values({ key: 'seed.catalogue_v1', value: '1' });
}
