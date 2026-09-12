import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome, ok, parseLimit } from '@/lib/api/respond';
import { createVisitorPass, listVisitors } from '@/lib/api/resources';

export const GET = withApi('visitors:read', async (principal, request) => {
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  return ok(await listVisitors(principal, limit));
});

export const POST = withApi('visitors:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createVisitorPass(principal, body);
  if (!result.ok) return failFromOutcome(result, 'No such visitor pass.');
  return created(result.data);
});
