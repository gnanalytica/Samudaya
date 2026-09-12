import { Ticket } from 'lucide-react';
import { ROLE_LABEL, formatInviteCode, relativeTime, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { InviteForm } from './invite-form';
import { revokeInviteCode } from './actions';

export const metadata = { title: 'Invite codes' };

type CodeState = { label: string; tone: 'success' | 'neutral' | 'danger' | 'warning' };

function codeState(code: {
  revoked_at: string | null;
  expires_at: string | null;
  max_uses: number | null;
  used_count: number;
}): CodeState {
  if (code.revoked_at) return { label: 'Revoked', tone: 'danger' };
  if (code.expires_at && new Date(code.expires_at) <= new Date()) {
    return { label: 'Expired', tone: 'neutral' };
  }
  if (code.max_uses !== null && code.used_count >= code.max_uses) {
    return { label: 'Used up', tone: 'neutral' };
  }
  return { label: 'Active', tone: 'success' };
}

export default async function InvitesPage(props: PageProps<'/app/[community]/admin/invites'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'invites:manage');
  const supabase = await getSupabase();

  const [codes, units] = await Promise.all([
    supabase
      .from('invite_codes')
      .select(
        'id, code, label, role, max_uses, used_count, expires_at, revoked_at, created_at, units(block, number)',
      )
      .eq('community_id', community.id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase
      .from('units')
      .select('id, block, number')
      .eq('community_id', community.id)
      .order('block')
      .order('number'),
  ]);

  return (
    <>
      <PageHeader
        title="Invite codes"
        description="Nobody joins this community without one. Create a code, share it, revoke it whenever you like."
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
          <Card>
            <CardHeader title="Codes" description={`${codes.data?.length ?? 0} created`} />
            {codes.data?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Code
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Grants
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Used
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
                    {codes.data.map((code) => {
                      const state = codeState(code);
                      const revocable = state.label === 'Active';
                      return (
                        <tr key={code.id}>
                          <td className="px-5 py-3">
                            <span className="text-ink font-mono tracking-wider">
                              {formatInviteCode(code.code)}
                            </span>
                            {code.label ? (
                              <p className="text-ink-subtle text-xs">{code.label}</p>
                            ) : null}
                          </td>
                          <td className="text-ink-muted px-5 py-3">
                            {ROLE_LABEL[code.role]}
                            {code.units ? (
                              <p className="text-ink-subtle text-xs">{unitLabel(code.units)}</p>
                            ) : null}
                          </td>
                          <td className="text-ink-muted px-5 py-3">
                            {code.used_count}
                            {code.max_uses === null ? ' / ∞' : ` / ${code.max_uses}`}
                            <p className="text-ink-subtle text-xs">
                              {relativeTime(code.created_at)}
                            </p>
                          </td>
                          <td className="px-5 py-3">
                            <Badge tone={state.tone}>{state.label}</Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {revocable ? (
                              <form action={revokeInviteCode}>
                                <input type="hidden" name="slug" value={slug} />
                                <input type="hidden" name="id" value={code.id} />
                                <button
                                  type="submit"
                                  className="text-ink-muted hover:text-danger text-sm underline underline-offset-4"
                                >
                                  Revoke
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
                icon={<Ticket className="size-6" />}
                title="No codes yet"
                description="Create one and send it to a resident to get them in."
              />
            )}
          </Card>

          <InviteForm slug={slug} units={units.data ?? []} />
        </div>
      </PageBody>
    </>
  );
}
