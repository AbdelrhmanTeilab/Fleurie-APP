import { getDb, schema as s } from '@/db';
import { eq } from 'drizzle-orm';

// Sends through the configured provider. With no credentials, the message is stored as "manual"
// and shown in Admin > Outbox so staff can send it by hand (one tap opens WhatsApp / email).
export async function sendNotification(p: { customerId?: number; channel: 'whatsapp' | 'email'; to: string; template: string; body: string; subject?: string }) {
  const db = await getDb();
  const [row] = await db.insert(s.notifications).values({ customerId: p.customerId ?? null, channel: p.channel, toAddress: p.to, template: p.template, body: p.body }).returning();
  let status = 'manual', error: string | null = null;
  try {
    if (p.channel === 'email' && process.env.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: process.env.EMAIL_FROM || 'Fleurie <onboarding@resend.dev>', to: [p.to], subject: p.subject || 'Fleurie', text: p.body }),
      });
      status = r.ok ? 'sent' : 'failed'; if (!r.ok) error = await r.text();
    } else if (p.channel === 'whatsapp' && process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID) {
      // Meta Cloud API. Business-initiated messages must use an approved template:
      // verification codes use WHATSAPP_OTP_TEMPLATE; every other message uses WHATSAPP_MSG_TEMPLATE (one body variable = the full text).
      const isOtp = p.template.startsWith('otp_'), tpl = isOtp ? (process.env.WHATSAPP_OTP_TEMPLATE || 'otp_code') : process.env.WHATSAPP_MSG_TEMPLATE;
      if (tpl) {
        const text = isOtp ? (p.body.match(/\d{6}/)?.[0] ?? p.body) : p.body.replace(/\s*\n+\s*/g, ' ').slice(0, 1000);
        const r = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
          method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messaging_product: 'whatsapp', to: p.to.replace(/^\+/, ''), type: 'template',
            template: { name: tpl, language: { code: 'ar' }, components: [{ type: 'body', parameters: [{ type: 'text', text }] }] } }),
        });
        status = r.ok ? 'sent' : 'failed'; if (!r.ok) error = await r.text();
      }
    }
  } catch (e) { status = 'failed'; error = String(e); }
  await db.update(s.notifications).set({ status, error, sentAt: status === 'sent' ? new Date() : null }).where(eq(s.notifications.id, row.id));
  if (status === 'manual' && process.env.NODE_ENV !== 'production') console.log(`[outbox] ${p.channel} -> ${p.to}: ${p.body}`);
  return status;
}
