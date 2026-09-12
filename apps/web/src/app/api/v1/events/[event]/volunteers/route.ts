import { withApi } from '@/lib/api/handler';
import { fail, ok } from '@/lib/api/respond';
import { listVolunteerRoles } from '@/lib/api/resources';

export const GET = withApi('activities:read', async (principal, _request, context) => {
  const { event } = await context.params;
  const roles = await listVolunteerRoles(principal, event!);
  return roles ? ok(roles) : fail('not_found', 'No such event.');
});
