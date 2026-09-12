import { ShieldCheck } from 'lucide-react';
import { VISITOR_KIND_LABEL, relativeTime, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { VisitorStatusBadge } from '@/components/status-badge';
import { recordGateEvent } from '../visitors/actions';
import { GateSearch } from './gate-search';

export const metadata = { title: 'Gate desk' };

export default async function GatePage(props: PageProps<'/app/[community]/gate'>) {
  const { community: slug } = await props.params;
  const { q } = await props.searchParams;
  const { community } = await requireCapability(slug, 'gate:operate');
  const supabase = await getSupabase();

  const now = new Date().toISOString();
  const search = typeof q === 'string' ? q.trim() : '';

  let expectedQuery = supabase
    .from('visitor_passes')
    .select(
      'id, visitor_name, visitor_phone, kind, status, purpose, vehicle_number, party_size, pass_code, expected_at, units(block, number)',
    )
    .eq('community_id', community.id)
    .eq('status', 'expected')
    .gte('valid_until', now)
    .order('expected_at', { ascending: true })
    .limit(50);

  if (search) {
    // Gate staff type either the code the guest reads out or the guest's name.
    expectedQuery = expectedQuery.or(`pass_code.eq.${search},visitor_name.ilike.%${search}%`);
  }

  const [expected, inside] = await Promise.all([
    expectedQuery,
    supabase
      .from('visitor_passes')
      .select('id, visitor_name, kind, status, checked_in_at, party_size, units(block, number)')
      .eq('community_id', community.id)
      .eq('status', 'arrived')
      .order('checked_in_at', { ascending: false })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader
        title="Gate desk"
        description="Check a visitor in with the code they were given, or by name."
      />
      <PageBody>
        <div className="mb-5 max-w-md">
          <GateSearch slug={slug} defaultValue={search} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={search ? `Matches for “${search}”` : 'Expected today'}
              description={`${expected.data?.length ?? 0} waiting`}
            />
            {expected.data?.length ? (
              <ul className="divide-border-base divide-y">
                {expected.data.map((pass) => (
                  <li key={pass.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium">
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
                        </p>
                        {pass.vehicle_number || pass.purpose ? (
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {[pass.vehicle_number, pass.purpose].filter(Boolean).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                      <span className="bg-surface-sunken text-ink shrink-0 rounded-md px-2 py-1 font-mono text-base tracking-widest">
                        {pass.pass_code}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <form action={recordGateEvent}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={pass.id} />
                        <input type="hidden" name="status" value="arrived" />
                        <Button type="submit" size="sm">
                          Check in
                        </Button>
                      </form>
                      <form action={recordGateEvent}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={pass.id} />
                        <input type="hidden" name="status" value="denied" />
                        <Button type="submit" size="sm" variant="ghost">
                          Deny entry
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ShieldCheck className="size-6" />}
                title={search ? 'No match' : 'Nobody expected'}
                description={
                  search
                    ? 'Check the code, or ask the resident to create a pass.'
                    : 'Residents who pre-approve a guest will show up here.'
                }
              />
            )}
          </Card>

          <Card>
            <CardHeader
              title="Currently inside"
              description={`${inside.data?.length ?? 0} on the premises`}
            />
            {inside.data?.length ? (
              <ul className="divide-border-base divide-y">
                {inside.data.map((pass) => (
                  <li key={pass.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-ink truncate text-sm font-medium">{pass.visitor_name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {pass.units ? `${unitLabel(pass.units)} · ` : ''}
                        in {relativeTime(pass.checked_in_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <VisitorStatusBadge status={pass.status} />
                      <form action={recordGateEvent}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="id" value={pass.id} />
                        <input type="hidden" name="status" value="departed" />
                        <Button type="submit" size="sm" variant="secondary">
                          Check out
                        </Button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nobody inside" description="Checked-in visitors appear here." />
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
