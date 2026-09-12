import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome, ok } from '@/lib/api/respond';
import { createTask, getEvent, listTasks } from '@/lib/api/resources';

export const GET = withApi('events:read', async (principal, _request, context) => {
  const { event } = await context.params;
  const found = await getEvent(principal, event!);
  if (!found) return fail('not_found', 'No such event.');
  return ok(await listTasks(principal, found.id));
});

export const POST = withApi('events:write', async (principal, request, context) => {
  const { event } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createTask(principal, event!, body);
  if (!result.ok) return failFromOutcome(result, 'No such event.');
  return created(result.data);
});
