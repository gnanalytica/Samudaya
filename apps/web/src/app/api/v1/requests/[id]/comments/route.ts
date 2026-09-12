import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome } from '@/lib/api/respond';
import { addRequestComment } from '@/lib/api/resources';

export const POST = withApi('requests:write', async (principal, request, context) => {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await addRequestComment(principal, id!, body);
  if (!result.ok) return failFromOutcome(result, 'No such request.');
  return created(result.data);
});
