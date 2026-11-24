'use client';
import { useRef } from 'react';

export function LivePreview({ children, nameAr, nameEn, sloganAr, sloganEn, lang }: { children: React.ReactNode; nameAr: string; nameEn: string; sloganAr: string; sloganEn: string; lang: 'ar' | 'en' }) {
  const prev = useRef<HTMLDivElement>(null);
  const update = (e: React.FormEvent<HTMLDivElement>) => {
    const f = (e.currentTarget.querySelector('form') as HTMLFormElement); if (!f || !prev.current) return;
    const g = (n: string) => (f.elements.namedItem(n) as HTMLInputElement)?.value;
    const p = prev.current;
    p.style.setProperty('--primary', g('theme.primary')); p.style.setProperty('--accent', g('theme.accent')); p.style.setProperty('--bg', g('theme.bg')); p.style.setProperty('--surface', g('theme.surface')); p.style.setProperty('--text', g('theme.text'));
    (p.querySelector('[data-n]') as HTMLElement).textContent = g(`brand.name_${lang}`) || ''; (p.querySelector('[data-s]') as HTMLElement).textContent = g(`brand.slogan_${lang}`) || '';
  };
  return (
    <div onInput={update}>
      <div ref={prev} className="card wide" style={{ background: 'var(--bg)', textAlign: 'center', marginBottom: 16 }}>
        <div className="muted">{lang === 'ar' ? 'معاينة مباشرة' : 'Live preview'}</div>
        <div className="wordmark" data-n>{lang === 'ar' ? nameAr : nameEn}</div><div className="slogan" data-s>{lang === 'ar' ? sloganAr : sloganEn}</div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 14 }}>
          <span className="btn sm" style={{ background: 'var(--primary)' }}>{lang === 'ar' ? 'زر رئيسي' : 'Primary button'}</span>
          <span className="btn sm" style={{ background: 'var(--accent)' }}>{lang === 'ar' ? 'لون مميز' : 'Accent'}</span>
          <span className="btn sm" style={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--line)' }}>{lang === 'ar' ? 'بطاقة' : 'Card'}</span>
        </div>
      </div>
      {children}
    </div>
  );
}
