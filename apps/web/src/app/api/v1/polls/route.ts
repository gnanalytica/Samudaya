import { withApi } from '@/lib/api/handler';
import { ok, parseLimit } from '@/lib/api/respond';
import { listPolls } from '@/lib/api/resources';

export const GET = withApi('polls:read', async (principal, request) => {
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  return ok(await listPolls(principal, limit));
});
