import { Send, Users } from 'lucide-react';
import { ROLE_LABEL, can, normalizeRole, relativeTime, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { RemoveForm, RoleForm } from './member-controls';

export const metadata = { title: 'Residents' };

export default async function MembersPage(props: PageProps<'/app/[community]/admin/members'>) {
  const { community: slug } = await props.params;
  const { community, role, membership: me } = await requireCapability(slug, 'residents:remove');
  const supabase = await getSupabase();
  const committee = can(role, 'roles:manage');

  const { data: members } = await supabase
    .from('memberships')
    .select(
      'id, role, status, joined_at, profiles(full_name, email, phone), unit_occupants(relation, units(block, number))',
    )
    .eq('community_id', community.id)
    .eq('status', 'active')
    .order('joined_at', { ascending: false })
    .limit(1000);

  const rows = (members ?? []).map((member) => ({
    ...member,
    role: normalizeRole(member.role) ?? 'resident',
  }));
  const counts = {
    resident: rows.filter((m) => m.role === 'resident').length,
    staff: rows.filter((m) => m.role === 'staff').length,
    committee: rows.filter((m) => m.role === 'committee').length,
  };

  return (
    <>
      <PageHeader
        title="Residents"
        description={`${counts.resident} residents · ${counts.staff} staff · ${counts.committee} committee`}
        action={
          <ButtonLink href={`/app/${community.slug}/admin/invite`} size="sm" variant="secondary">
            <Send className="size-4" aria-hidden="true" />
            Invite
          </ButtonLink>
        }
      />
      <PageBody>
        <Card>
          <CardHeader
            title="Everyone in the society"
            description={
              committee
                ? 'The committee assigns roles. Staff run the society; residents take part.'
                : 'Staff can remove residents who have moved out. Roles are set by the committee.'
            }
          />
          {rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Flat
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border-base divide-y">
                  {rows.map((member) => {
                    const name = member.profiles?.full_name ?? 'Unnamed';
                    const flats = (member.unit_occupants ?? [])
                      .map((o) => (o.units ? `${unitLabel(o.units)} (${o.relation})` : null))
                      .filter(Boolean)
                      .join(', ');
                    const isMe = member.id === me.id;
                    const removable = !isMe && (committee || member.role === 'resident');
                    return (
                      <tr key={member.id} className="align-top">
                        <td className="px-5 py-3">
                          <p className="text-ink font-medium">
                            {name}
                            {isMe ? (
                              <span className="text-ink-subtle font-normal"> (you)</span>
                            ) : null}
                          </p>
                          <p className="text-ink-subtle text-xs">
                            {[member.profiles?.phone, member.profiles?.email]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <p className="text-ink-subtle text-xs">
                            joined {relativeTime(member.joined_at)}
                          </p>
                        </td>
                        <td className="text-ink-muted px-5 py-3">{flats || '—'}</td>
                        <td className="px-5 py-3">
                          {committee && !isMe ? (
                            <RoleForm
                              slug={slug}
                              membershipId={member.id}
                              role={member.role}
                              name={name}
                            />
                          ) : (
                            <Badge tone={member.role === 'resident' ? 'neutral' : 'brand'}>
                              {ROLE_LABEL[member.role]}
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {removable ? (
                            <RemoveForm slug={slug} membershipId={member.id} name={name} />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<Users className="size-6" />}
              title="Nobody here yet"
              description={`Share society code ${community.join_code} so residents can ask to join.`}
            />
          )}
        </Card>
      </PageBody>
    </>
  );
}
