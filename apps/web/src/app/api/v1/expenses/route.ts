import { withApi } from '@/lib/api/handler';
import { created, fail, failFromOutcome } from '@/lib/api/respond';
import { createExpense } from '@/lib/api/resources';

/**
 * Files an expense. It arrives pending and stays that way until a human admin
 * approves it in the app — `review_expense` refuses self-approval, so an
 * integration cannot spend the society's money on its own.
 */
export const POST = withApi('expenses:write', async (principal, request) => {
  const body = await request.json().catch(() => null);
  if (!body) return fail('invalid_request', 'Send a JSON body.');

  const result = await createExpense(principal, body);
  if (!result.ok) return failFromOutcome(result, 'No such event.');
  return created(result.data);
});
