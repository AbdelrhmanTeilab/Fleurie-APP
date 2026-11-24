import './globals.css';
import type { Metadata } from 'next';
import { getI18n } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const { brand } = await getI18n();
  return { title: `${brand.name} | ${brand.slogan}`, description: brand.slogan };
}
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, dir, settings } = await getI18n();
  const theme = `:root{--primary:${settings['theme.primary']};--accent:${settings['theme.accent']};--bg:${settings['theme.bg']};--surface:${settings['theme.surface']};--text:${settings['theme.text']}}`;
  return (
    <html lang={lang} dir={dir}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cormorant+Garamond:wght@500;600&family=Tajawal:wght@400;500;700&display=swap" />
        <style dangerouslySetInnerHTML={{ __html: theme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
