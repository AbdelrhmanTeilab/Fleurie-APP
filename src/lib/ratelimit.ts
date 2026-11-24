import { headers } from 'next/headers';

// Simple in-memory limiter (per server process). Fine for one small server; use a shared store if you ever run several.
const hits = new Map<string, number[]>();
export async function clientIp() { const h = await headers(); return (h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || 'local').trim(); }
export function tooMany(key: string, max: number, windowMs: number): boolean {
  const now = Date.now(), arr = (hits.get(key) ?? []).filter(t => now - t < windowMs);
  if (arr.length >= max) { hits.set(key, arr); return true; }
  arr.push(now); hits.set(key, arr);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > windowMs) hits.delete(k);
  return false;
}
export async function limited(scope: string, max: number, windowMs: number, extra = '') { return tooMany(`${scope}:${await clientIp()}:${extra}`, max, windowMs); }
