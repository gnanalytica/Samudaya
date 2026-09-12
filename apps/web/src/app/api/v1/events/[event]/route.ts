import { withApi } from '@/lib/api/handler';
import { fail, ok } from '@/lib/api/respond';
import { getEvent } from '@/lib/api/resources';

export const GET = withApi('events:read', async (principal, _request, context) => {
  const { event } = await context.params;
  const found = await getEvent(principal, event!);
  return found ? ok(found) : fail('not_found', 'No such event.');
});
