import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome, ok } from '@/lib/api/respond';
import { createActivity, listActivities } from '@/lib/api/resources';

export const GET = withApi('activities:read', async (principal, _request, context) => {
  const { event } = await context.params;
  const activities = await listActivities(principal, event!);
  return activities ? ok(activities) : fail('not_found', 'No such event.');
});

export const POST = withApi('activities:write', async (principal, request, context) => {
  const { event } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createActivity(principal, { ...body, event_id: event });
  if (!result.ok) return failFromOutcome(result, 'No such event.');
  return created(result.data);
});
