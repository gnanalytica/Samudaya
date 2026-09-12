import { authenticate, allows, isFailure, type ApiPrincipal } from './auth';
import { fail } from './respond';

/**
 * Wraps a route handler with authentication and a scope check, so every
 * endpoint gets the same 401/403 behaviour and the same error shape.
 */
export function withApi(
  scope: string,
  handler: (
    principal: ApiPrincipal,
    request: Request,
    context: { params: Promise<Record<string, string>> },
  ) => Promise<Response>,
) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const communityParam = new URL(request.url).searchParams.get('community');
    const result = await authenticate(request, communityParam);

    if (isFailure(result)) {
      return fail(result.error, result.message);
    }

    const { principal } = result;
    if (!allows(principal, scope)) {
      return fail('forbidden', `This key is missing the “${scope}” scope.`);
    }

    try {
      return await handler(principal, request, context);
    } catch (error) {
      // Surface the PostgREST code where there is one — an RLS denial should
      // read as 403, not as an opaque 500.
      const code = (error as { code?: string } | null)?.code;
      if (code === '42501') return fail('forbidden', 'You do not have access to that.');
      if (code === '23505') return fail('conflict', 'That already exists.');
      if (code === '23P01') return fail('conflict', 'That time slot is already taken.');
      console.error('[api] unhandled error', error);
      return fail('server_error', 'Something went wrong handling that request.');
    }
  };
}
