import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome, ok, parseLimit } from '@/lib/api/respond';
import { createRequest, listRequests } from '@/lib/api/resources';

export const GET = withApi('requests:read', async (principal, request) => {
  const params = new URL(request.url).searchParams;
  return ok(
    await listRequests(principal, {
      limit: parseLimit(params.get('limit')),
      status: params.get('status'),
    }),
  );
});

export const POST = withApi('requests:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createRequest(principal, body);
  if (!result.ok) return failFromOutcome(result, 'No such request.');
  return created(result.data);
});
