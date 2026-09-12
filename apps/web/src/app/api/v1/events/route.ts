import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome, ok, parseLimit } from '@/lib/api/respond';
import { createEvent, listEvents } from '@/lib/api/resources';

export const GET = withApi('events:read', async (principal, request) => {
  const params = new URL(request.url).searchParams;
  return ok(
    await listEvents(principal, {
      limit: parseLimit(params.get('limit')),
      status: params.get('status'),
    }),
  );
});

export const POST = withApi('events:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createEvent(principal, body);
  if (!result.ok) return failFromOutcome(result, 'No such event.');
  return created(result.data);
});
