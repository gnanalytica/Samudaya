import { Users } from 'lucide-react';
import { ASSIGNABLE_ROLES, ROLE_LABEL, relativeTime, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { EmptyState } from '@/components/ui/empty-state';
import { changeMemberRole, setMemberStatus } from './actions';

export const metadata = { title: 'Members' };

export default async function MembersPage(props: PageProps<'/app/[community]/admin/members'>) {
  const { community: slug } = await props.params;
  const { community, membership: me } = await requireCapability(slug, 'members:manage');
  const supabase = await getSupabase();

  const { data: members } = await supabase
    .from('memberships')
    .select(
      'id, role, status, joined_at, user_id, profiles(full_name, email, phone), unit_occupants(units(block, number))',
    )
    .eq('community_id', community.id)
    .order('role', { ascending: false })
    .order('joined_at', { ascending: false })
    .limit(500);

  return (
    <>
      <PageHeader
        title="Members"
        description="Everyone with access to this community, and what they can do."
      />
      <PageBody>
        <Card>
          <CardHeader title="People" description={`${members?.length ?? 0} members`} />
          {members?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Name
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Unit
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Role
                    </th>
                    <th scope="col" className="px-5 py-2.5 font-medium">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-border-base divide-y">
                  {members.map((member) => {
                    const isSelf = member.id === me.id;
                    const isOwner = member.role === 'owner';
                    const units = member.unit_occupants
                      .map((occupant) => (occupant.units ? unitLabel(occupant.units) : null))
                      .filter(Boolean)
                      .join(', ');

                    return (
                      <tr key={member.id}>
                        <td className="px-5 py-3">
                          <p className="text-ink">
                            {member.profiles?.full_name ?? 'Unnamed'}
                            {isSelf ? (
                              <span className="text-ink-subtle ml-1.5 text-xs">(you)</span>
                            ) : null}
                          </p>
                          <p className="text-ink-subtle text-xs">
                            {member.profiles?.email ?? member.profiles?.phone ?? '—'}
                          </p>
                        </td>
                        <td className="text-ink-muted px-5 py-3">{units || '—'}</td>
                        <td className="px-5 py-3">
                          {/* An owner's role is only changeable by another owner,
                              which the database enforces; showing a dropdown that
                              always fails would be worse than showing a label. */}
                          {isOwner || isSelf ? (
                            <Badge tone={isOwner ? 'brand' : 'neutral'}>
                              {ROLE_LABEL[member.role]}
                            </Badge>
                          ) : (
                            <form action={changeMemberRole} className="flex items-center gap-2">
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="membership_id" value={member.id} />
                              <label htmlFor={`role-${member.id}`} className="sr-only">
                                Role for {member.profiles?.full_name ?? 'this member'}
                              </label>
                              <Select
                                id={`role-${member.id}`}
                                name="role"
                                defaultValue={member.role}
                                className="h-8 py-1 text-xs"
                              >
                                {ASSIGNABLE_ROLES.map((role) => (
                                  <option key={role} value={role}>
                                    {ROLE_LABEL[role]}
                                  </option>
                                ))}
                              </Select>
                              <Button type="submit" size="sm" variant="ghost">
                                Save
                              </Button>
                            </form>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={member.status === 'active' ? 'success' : 'warning'}>
                            {member.status}
                          </Badge>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            joined {relativeTime(member.joined_at)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!isSelf && !isOwner ? (
                            <form action={setMemberStatus}>
                              <input type="hidden" name="slug" value={slug} />
                              <input type="hidden" name="membership_id" value={member.id} />
                              <input
                                type="hidden"
                                name="status"
                                value={member.status === 'active' ? 'suspended' : 'active'}
                              />
                              <button
                                type="submit"
                                className="text-ink-muted hover:text-ink text-sm underline underline-offset-4"
                              >
                                {member.status === 'active' ? 'Suspend' : 'Restore'}
                              </button>
                            </form>
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
              title="No members yet"
              description="Create an invite code and share it to get people in."
            />
          )}
        </Card>
      </PageBody>
    </>
  );
}
