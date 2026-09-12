import { withApi } from '@/lib/api/handler';
import { fail, failFromOutcome, ok } from '@/lib/api/respond';
import { updateTask } from '@/lib/api/resources';

export const PATCH = withApi('events:write', async (principal, request, context) => {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await updateTask(principal, id!, body);
  if (!result.ok) return failFromOutcome(result, 'No such task.');
  return ok(result.data);
});
