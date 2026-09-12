import { UserPlus } from 'lucide-react';
import { ASSIGNABLE_ROLES, ROLE_LABEL, relativeTime, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { reviewJoinRequest } from '../events/actions';

export const metadata = { title: 'Join requests' };

export default async function JoinRequestsPage(
  props: PageProps<'/app/[community]/admin/requests'>,
) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'joinrequests:review');
  const supabase = await getSupabase();

  const { data: requests } = await supabase
    .from('join_requests')
    .select(
      'id, claimed_name, claimed_phone, relation, status, created_at, reviewed_at, units(block, number), profiles!join_requests_user_id_fkey(full_name, email)',
    )
    .eq('community_id', community.id)
    .order('status')
    .order('created_at', { ascending: false })
    .limit(100);

  const pending = (requests ?? []).filter((request) => request.status === 'pending');
  const decided = (requests ?? []).filter((request) => request.status !== 'pending');

  return (
    <>
      <PageHeader
        title="Join requests"
        description={`Residents who entered Society ID ${community.join_code} and are waiting for you.`}
      />
      <PageBody>
        <Card>
          <CardHeader title="Waiting" description={`${pending.length} pending`} />
          {pending.length ? (
            <ul className="divide-border-base divide-y">
              {pending.map((request) => (
                <li key={request.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-semibold">{request.claimed_name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {request.units ? unitLabel(request.units) : 'No flat claimed'}
                        {request.claimed_phone ? ` · ${request.claimed_phone}` : ''}
                        {request.profiles?.email ? ` · ${request.profiles.email}` : ''}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        asked {relativeTime(request.created_at)} · claims to be the{' '}
                        {request.relation}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <form action={reviewJoinRequest} className="flex items-center gap-2">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="request_id" value={request.id} />
                        <input type="hidden" name="approve" value="1" />
                        <label htmlFor={`role-${request.id}`} className="sr-only">
                          Role for {request.claimed_name}
                        </label>
                        <Select
                          id={`role-${request.id}`}
                          name="role"
                          defaultValue="resident"
                          className="h-9 py-1 text-xs"
                        >
                          {ASSIGNABLE_ROLES.map((memberRole) => (
                            <option key={memberRole} value={memberRole}>
                              {ROLE_LABEL[memberRole]}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="sm">
                          Approve
                        </Button>
                      </form>

                      <form action={reviewJoinRequest}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="request_id" value={request.id} />
                        <input type="hidden" name="approve" value="0" />
                        <Button type="submit" size="sm" variant="ghost">
                          Decline
                        </Button>
                      </form>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<UserPlus className="size-6" />}
              title="Nobody waiting"
              description={`Share Society ID ${community.join_code} and requests will land here.`}
            />
          )}
        </Card>

        {decided.length ? (
          <Card className="mt-5">
            <CardHeader title="Recently decided" />
            <ul className="divide-border-base divide-y">
              {decided.slice(0, 20).map((request) => (
                <li key={request.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm">{request.claimed_name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {request.units ? unitLabel(request.units) : '—'} ·{' '}
                      {relativeTime(request.reviewed_at)}
                    </p>
                  </div>
                  <Badge tone={request.status === 'approved' ? 'success' : 'neutral'}>
                    {request.status}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}
