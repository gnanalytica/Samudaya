import { Plus, Users, X } from 'lucide-react';
import { VISITOR_KIND_LABEL, relativeTime, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { VisitorStatusBadge } from '@/components/status-badge';
import { cancelVisitorPass } from './actions';

export const metadata = { title: 'Visitors' };

export default async function VisitorsPage(props: PageProps<'/app/[community]/visitors'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const { data: passes } = await supabase
    .from('visitor_passes')
    .select(
      'id, visitor_name, visitor_phone, kind, status, purpose, vehicle_number, party_size, pass_code, expected_at, valid_until, units(block, number)',
    )
    .eq('community_id', community.id)
    .order('expected_at', { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader
        title="Visitors"
        description="Pre-approve guests so the gate knows to expect them."
        action={
          <ButtonLink href={`/app/${slug}/visitors/new`} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Invite a visitor
          </ButtonLink>
        }
      />
      <PageBody>
        <Card>
          {passes?.length ? (
            <ul className="divide-border-base divide-y">
              {passes.map((pass) => {
                const active = pass.status === 'expected' || pass.status === 'arrived';
                return (
                  <li key={pass.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-ink truncate text-sm font-medium">
                        {pass.visitor_name}
                        {pass.party_size > 1 ? (
                          <span className="text-ink-subtle ml-1.5">+{pass.party_size - 1}</span>
                        ) : null}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {VISITOR_KIND_LABEL[pass.kind]}
                        {pass.units ? ` · ${unitLabel(pass.units)}` : ''}
                        {' · '}
                        {relativeTime(pass.expected_at)}
                        {pass.vehicle_number ? ` · ${pass.vehicle_number}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {active ? (
                        <span
                          className="bg-surface-sunken text-ink rounded-md px-2 py-1 font-mono text-sm tracking-widest"
                          aria-label={`Gate code ${pass.pass_code.split('').join(' ')}`}
                        >
                          {pass.pass_code}
                        </span>
                      ) : null}
                      <VisitorStatusBadge status={pass.status} />
                      {pass.status === 'expected' ? (
                        <form action={cancelVisitorPass}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="id" value={pass.id} />
                          <button
                            type="submit"
                            aria-label={`Cancel pass for ${pass.visitor_name}`}
                            className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-1.5"
                          >
                            <X className="size-4" aria-hidden="true" />
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Users className="size-6" />}
              title="No visitors yet"
              description="Create a pass and your guest gets a code for the gate."
              action={
                <ButtonLink href={`/app/${slug}/visitors/new`} size="sm" variant="secondary">
                  Invite a visitor
                </ButtonLink>
              }
            />
          )}
        </Card>
      </PageBody>
    </>
  );
}
