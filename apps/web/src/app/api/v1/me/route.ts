import { withApi } from '@/lib/api/handler';
import { ok } from '@/lib/api/respond';
import { whoami } from '@/lib/api/resources';

export const GET = withApi('members:read', async (principal) => ok(await whoami(principal)));
