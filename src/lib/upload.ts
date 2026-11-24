import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, schema as s } from '@/db';

const TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };
export const MIME_BY_EXT: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' };

// Validates the image (type, size, real file signature) and stores it in the database. Returns the stored name or an error.
export async function saveImage(file: File | null, maxBytes = 3 * 1024 * 1024, priv = false): Promise<{ name?: string; error?: 'type' | 'size' }> {
  if (!file || !file.size) return {};
  const ext = TYPES[file.type]; if (!ext) return { error: 'type' };
  if (file.size > maxBytes) return { error: 'size' };
  const buf = Buffer.from(await file.arrayBuffer());
  const magic = buf.subarray(0, 12).toString('latin1');
  const okMagic = (ext === 'png' && buf[0] === 0x89 && magic.slice(1, 4) === 'PNG') || (ext === 'jpg' && buf[0] === 0xff && buf[1] === 0xd8) || (ext === 'webp' && magic.startsWith('RIFF') && magic.slice(8, 12) === 'WEBP');
  if (!okMagic) return { error: 'type' };
  const name = `${randomBytes(12).toString('hex')}.${ext}`;
  const db = await getDb();
  await db.insert(s.files).values({ name, mime: MIME_BY_EXT[ext], isPrivate: priv, data: buf.toString('base64') });
  return { name };
}
// Returns the file bytes if it exists with the requested visibility.
export async function loadFile(name: string, priv: boolean): Promise<{ buf: Buffer; mime: string } | null> {
  const db = await getDb();
  const [f] = await db.select().from(s.files).where(eq(s.files.name, name));
  if (!f || f.isPrivate !== priv) return null;
  return { buf: Buffer.from(f.data, 'base64'), mime: f.mime };
}
