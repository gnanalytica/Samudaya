import { withApi } from '@/lib/api/handler';
import { ok, parseLimit } from '@/lib/api/respond';
import { listInvoices } from '@/lib/api/resources';

export const GET = withApi('billing:read', async (principal, request) => {
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  return ok(await listInvoices(principal, limit));
});
