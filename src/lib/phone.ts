export function normalizePhone(input: string): string | null {
  let d = String(input || '').replace(/[^\d]/g, '');
  const ar = '٠١٢٣٤٥٦٧٨٩';
  d = String(input || '').replace(/[٠-٩]/g, c => String(ar.indexOf(c))).replace(/[^\d]/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (/^01\d{9}$/.test(d)) d = '20' + d.slice(1);
  return /^\d{10,15}$/.test(d) ? d : null;
}
