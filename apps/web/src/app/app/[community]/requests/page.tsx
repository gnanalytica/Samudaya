import Link from 'next/link';
import { Plus, Wrench } from 'lucide-react';
import { REQUEST_CATEGORY_LABEL, can, relativeTime, ticketRef, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { PriorityBadge, RequestStatusBadge } from '@/components/status-badge';

export const metadata = { title: 'Requests' };

const OPEN_STATUSES = ['open', 'acknowledged', 'in_progress'] as const;

export default async function RequestsPage(props: PageProps<'/app/[community]/requests'>) {
  const { community: slug } = await props.params;
  const { show } = await props.searchParams;
  const { community, role } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const showClosed = show === 'closed';
  const base = `/app/${community.slug}`;

  const { data: requests } = await supabase
    .from('service_requests')
    .select('id, ticket_no, title, category, status, priority, created_at, units(block, number)')
    .eq('community_id', community.id)
    .in('status', showClosed ? ['resolved', 'closed', 'rejected'] : [...OPEN_STATUSES])
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <>
      <PageHeader
        title="Service requests"
        description={
          can(role, 'requests:triage')
            ? 'Everything raised across the community.'
            : 'Issues you’ve reported, and anything raised for your flat.'
        }
        action={
          <ButtonLink href={`${base}/requests/new`} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            New request
          </ButtonLink>
        }
      />

      <PageBody>
        <div className="border-border-base bg-surface-raised mb-4 flex gap-1 rounded-lg border p-1 text-sm">
          {[
            { label: 'Open', href: `${base}/requests`, active: !showClosed },
            { label: 'Closed', href: `${base}/requests?show=closed`, active: showClosed },
          ].map((tab) => (
            <Link
              key={tab.label}
              href={tab.href}
              aria-current={tab.active ? 'page' : undefined}
              className={
                tab.active
                  ? 'bg-surface-sunken text-ink rounded-md px-3 py-1.5 font-medium'
                  : 'text-ink-muted hover:text-ink rounded-md px-3 py-1.5'
              }
            >
              {tab.label}
            </Link>
          ))}
        </div>

        <Card>
          {requests?.length ? (
            <ul className="divide-border-base divide-y">
              {requests.map((request) => (
                <li key={request.id}>
                  <Link
                    href={`${base}/requests/${request.id}`}
                    className="hover:bg-surface-sunken flex items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-ink truncate text-sm font-medium">{request.title}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        <span className="font-mono">{ticketRef(request.ticket_no)}</span>
                        {' · '}
                        {REQUEST_CATEGORY_LABEL[request.category]}
                        {request.units ? ` · ${unitLabel(request.units)}` : ''}
                        {' · '}
                        {relativeTime(request.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <PriorityBadge priority={request.priority} />
                      <RequestStatusBadge status={request.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Wrench className="size-6" />}
              title={showClosed ? 'Nothing closed yet' : 'No open requests'}
              description={
                showClosed
                  ? 'Resolved and closed requests will be listed here.'
                  : 'Report a leak, a broken light, or anything else that needs attention.'
              }
              action={
                showClosed ? undefined : (
                  <ButtonLink href={`${base}/requests/new`} size="sm" variant="secondary">
                    Raise a request
                  </ButtonLink>
                )
              }
            />
          )}
        </Card>
      </PageBody>
    </>
  );
}
