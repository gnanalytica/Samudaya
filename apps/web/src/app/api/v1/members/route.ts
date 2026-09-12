import { withApi } from '@/lib/api/handler';
import { ok, parseLimit } from '@/lib/api/respond';
import { listMembers } from '@/lib/api/resources';

export const GET = withApi('members:read', async (principal, request) => {
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  return ok(await listMembers(principal, limit));
});
