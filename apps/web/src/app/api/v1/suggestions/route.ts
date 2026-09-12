import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome } from '@/lib/api/respond';
import { suggestActivity } from '@/lib/api/resources';

export const POST = withApi('activities:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await suggestActivity(principal, body);
  if (!result.ok) return failFromOutcome(result, 'Not found.');
  return created(result.data);
});
