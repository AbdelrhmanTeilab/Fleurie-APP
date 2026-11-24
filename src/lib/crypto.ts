import { randomBytes, scryptSync, timingSafeEqual, createHash, randomInt } from 'node:crypto';

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltHex, keyHex] = stored.split('$');
  if (alg !== 'scrypt' || !saltHex || !keyHex) return false;
  const key = scryptSync(pw, Buffer.from(saltHex, 'hex'), 64, { N: 16384, r: 8, p: 1 });
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = () => randomBytes(32).toString('hex');
export const newOtp = () => String(randomInt(100000, 1000000));
export const randomPassword = () => randomBytes(9).toString('base64url');
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return 'short';
  if (!/[A-Za-z\u0600-\u06FF]/.test(pw) || !/\d/.test(pw)) return 'weak';
  return null;
}
