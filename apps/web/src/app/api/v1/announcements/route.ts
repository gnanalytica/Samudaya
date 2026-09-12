import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome, ok, parseLimit } from '@/lib/api/respond';
import { createAnnouncement, listAnnouncements } from '@/lib/api/resources';

export const GET = withApi('announcements:read', async (principal, request) => {
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  return ok(await listAnnouncements(principal, limit));
});

export const POST = withApi('announcements:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createAnnouncement(principal, body);
  if (!result.ok) return failFromOutcome(result, 'No such announcement.');
  return created(result.data);
});
