export const tagClass = (st: string) => (st === 'confirmed' || st === 'completed' || st === 'approved' ? 'ok' : st === 'cancelled' || st === 'rejected' ? 'bad' : 'warn');
