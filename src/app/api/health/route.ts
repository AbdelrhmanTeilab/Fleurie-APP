// Lightweight check for uptime monitors. Deliberately does not touch the database (keeps the free database asleep when idle).
export const dynamic = 'force-dynamic';
export async function GET() { return new Response('ok', { headers: { 'Cache-Control': 'no-store' } }); }
