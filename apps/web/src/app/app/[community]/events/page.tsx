import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { can, countdown, formatDate, formatMoney, fundedPercent } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { listEvents, getStatsFor } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar, ReadinessBar } from '@/components/badges';

export const metadata = { title: 'Events' };

export default async function EventsPage(props: PageProps<'/app/[community]/events'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCommunity(slug);

  const events = await listEvents(community.id);
  const stats = await getStatsFor(events.map((event) => event.id));

  const upcoming = events.filter(
    (event) => event.status === 'published' || event.status === 'draft',
  );
  const past = events.filter(
    (event) => event.status === 'completed' || event.status === 'cancelled',
  );

  const card = (event: (typeof events)[number]) => {
    const s = stats.get(event.id);
    const funded = fundedPercent(s?.fundRaised ?? 0, s?.fundTarget ?? 0);
    return (
      <Link
        key={event.id}
        href={`/app/${slug}/events/${event.slug}`}
        className="border-border-base bg-surface-raised hover:bg-surface-sunken block rounded-xl border p-5 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink truncate text-base font-semibold">
              <span className="mr-1.5">{event.emoji}</span>
              {event.name}
            </p>
            <p className="text-ink-muted mt-0.5 text-sm">
              {formatDate(event.starts_on)}
              {event.venue ? ` · ${event.venue}` : ''}
              {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        {event.status !== 'cancelled' ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                <span>Readiness</span>
                <span>{s?.readiness ?? 0}%</span>
              </div>
              <ReadinessBar percent={s?.readiness ?? 0} />
            </div>
            <div>
              <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                <span>
                  {formatMoney(s?.fundRaised ?? 0, community.currency)} of{' '}
                  {formatMoney(s?.fundTarget ?? 0, community.currency)}
                </span>
                <span>{funded}%</span>
              </div>
              <FundBar percent={funded} />
            </div>
          </div>
        ) : null}

        <p className="text-ink-subtle mt-3 text-xs">
          {s?.contributors ?? 0} contributed · {s?.participants ?? 0} performing ·{' '}
          {s?.volunteers ?? 0} volunteering
        </p>
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="Events"
        description="Every event carries its own people, tasks, fund and ledger."
        action={
          can(role, 'events:prepare') ? (
            <ButtonLink href={`/app/${slug}/admin/events/new`} size="sm">
              <Plus className="size-4" aria-hidden="true" />
              Create event
            </ButtonLink>
          ) : undefined
        }
      />
      <PageBody>
        {events.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No events yet"
              description={
                can(role, 'events:prepare')
                  ? 'Create the first one — the wizard sets up the budget, checklist and fund rule.'
                  : 'When the committee plans something, it will appear here.'
              }
              action={
                can(role, 'events:prepare') ? (
                  <ButtonLink href={`/app/${slug}/admin/events/new`} size="sm" variant="secondary">
                    Create event
                  </ButtonLink>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            {upcoming.length > 0 ? (
              <>
                <h2 className="text-ink-soft mb-3 text-sm font-semibold">Upcoming</h2>
                <div className="space-y-3">{upcoming.map(card)}</div>
              </>
            ) : null}
            {past.length > 0 ? (
              <>
                <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Past</h2>
                <div className="space-y-3">{past.map(card)}</div>
              </>
            ) : null}
          </>
        )}
      </PageBody>
    </>
  );
}
