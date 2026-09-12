import { withApi } from '@/lib/api/handler';
import { fail, failFromOutcome, ok } from '@/lib/api/respond';
import { getRequest, updateRequest } from '@/lib/api/resources';

export const GET = withApi('requests:read', async (principal, _request, context) => {
  const { id } = await context.params;
  const found = await getRequest(principal, id!);
  return found ? ok(found) : fail('not_found', 'No such request.');
});

export const PATCH = withApi('requests:write', async (principal, request, context) => {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await updateRequest(principal, id!, body);
  if (!result.ok) return failFromOutcome(result, 'No such request.');
  return result.data ? ok(result.data) : fail('not_found', 'No such request.');
});
