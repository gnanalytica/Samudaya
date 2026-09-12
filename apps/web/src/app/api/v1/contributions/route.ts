import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome } from '@/lib/api/respond';
import { contribute } from '@/lib/api/resources';

export const POST = withApi('events:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await contribute(principal, body);
  if (!result.ok) return failFromOutcome(result, 'No such event.');
  return created(result.data);
});
