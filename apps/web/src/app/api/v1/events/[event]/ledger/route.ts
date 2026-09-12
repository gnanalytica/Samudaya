import { withApi } from '@/lib/api/handler';
import { fail, ok } from '@/lib/api/respond';
import { getLedger } from '@/lib/api/resources';

/**
 * The full financial picture for one event: raised, spent, available, and
 * every expense a resident is allowed to see. RLS decides that last part —
 * a key acting as a resident sees approved rows only.
 */
export const GET = withApi('expenses:read', async (principal, _request, context) => {
  const { event } = await context.params;
  const ledger = await getLedger(principal, event!);
  return ledger ? ok(ledger) : fail('not_found', 'No such event.');
});
