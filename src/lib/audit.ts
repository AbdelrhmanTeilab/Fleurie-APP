import { getDb, schema as s } from '@/db';
export async function logAction(actor: { kind: 'staff' | 'customer' | 'system'; id?: number; name?: string }, action: string, entity = '', entityId: string | number = '', details: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.insert(s.activityLogs).values({ actorKind: actor.kind, actorId: actor.id ?? null, actorName: actor.name ?? '', action, entity, entityId: String(entityId), details });
}
