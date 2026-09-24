import Link from 'next/link';
import { CalendarDays, CheckCircle2, Megaphone, Plus } from 'lucide-react';
import {
  can,
  countdown,
  festivalFor,
  formatDate,
  formatMoney,
  fundAsk,
  fundBarSegments,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { listEvents, getStatsFor } from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { festivalVars } from '@/components/festival';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar } from '@/components/badges';

export const metadata = { title: 'Events' };

export default async function EventsPage(props: PageProps<'/app/[community]/events'>) {
  const { community: slug } = await props.params;
  const { proposed: justProposed } = await props.searchParams;
  // Committee in resident view sees exactly what residents see.
  const { community, viewRole: role, user } = await requireCommunity(slug);

  const events = await listEvents(community.id);
  const stats = await getStatsFor(events.map((event) => event.id));
  const staff = can(role, 'events:manage');
  const catalogue = await getCatalogue(community.id);
  const typeLabel = new Map(catalogue.event_type.map((item) => [item.id, item.label]));

  // RLS already hides drafts and other people's proposals from residents.
  const mine = events.filter(
    (event) => event.status === 'proposed' && event.created_by === user.id,
  );
  const live = events.filter(
    (event) => event.status === 'published' || (staff && event.status === 'draft'),
  );
  const past = events
    .filter((event) => event.status === 'completed' || event.status === 'cancelled')
    .filter((event) => event.kind === 'event' || event.status === 'completed');

  const card = (event: (typeof events)[number]) => {
    const s = stats.get(event.id);
    const bar = fundBarSegments(
      s?.fundRaised ?? 0,
      s?.fundPending ?? 0,
      s?.fundTarget ?? 0,
      s?.fundCarried ?? 0,
    );
    const funded = bar.confirmed;
    // A list of events should look like a year, not like a spreadsheet: each
    // card carries its own festival's colour down its edge.
    const festival = festivalFor(typeLabel.get(event.event_type_id ?? ''), event.name);
    return (
      <Link
        key={event.id}
        href={`/app/${slug}/events/${event.slug}`}
        style={{ ...festivalVars(festival), borderLeftColor: 'var(--accent)' }}
        className="border-border-base bg-surface-raised hover:bg-surface-sunken block rounded-xl border border-l-4 p-5 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink truncate text-base font-semibold">
              <span className="mr-1.5">{event.emoji}</span>
              {event.name}
            </p>
            <p className="text-ink-muted mt-0.5 text-sm">
              {event.kind === 'campaign' ? 'Fundraising campaign · ' : ''}
              {formatDate(event.starts_on)}
              {event.venue ? ` · ${event.venue}` : ''}
              {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
            </p>
          </div>
          <EventStatusBadge status={event.status} />
        </div>

        {event.status !== 'cancelled' && event.status !== 'proposed' ? (
          <div className="mt-4">
            <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
              <span>
                {formatMoney(s?.fundRaised ?? 0, community.currency)} of{' '}
                {formatMoney(fundAsk(s?.fundTarget ?? 0, s?.fundCarried ?? 0), community.currency)}{' '}
                raised · {formatMoney(s?.spent ?? 0, community.currency)} spent
              </span>
              <span>{funded}%</span>
            </div>
            <FundBar percent={funded} pendingPercent={bar.pending} />
            {(s?.fundCarried ?? 0) > 0 ? (
              <p className="text-ink-subtle mt-2 text-xs">
                After {formatMoney(s?.fundCarried ?? 0, community.currency)} carried across by the
                committee
              </p>
            ) : null}
            <p className="text-ink-subtle mt-2 text-xs">
              {s?.contributors ?? 0} households contributed · {s?.participants ?? 0} registered for
              activities
            </p>
          </div>
        ) : null}
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="Events"
        description="Every event and campaign with its budget, spending and activities."
        action={
          <div className="flex flex-wrap gap-2">
            {can(role, 'campaigns:propose') ? (
              <ButtonLink href={`/app/${slug}/events/propose`} size="sm" variant="secondary">
                <Megaphone className="size-4" aria-hidden="true" />
                Start a campaign
              </ButtonLink>
            ) : null}
            {staff ? (
              <ButtonLink href={`/app/${slug}/admin/events/new`} size="sm">
                <Plus className="size-4" aria-hidden="true" />
                Create event
              </ButtonLink>
            ) : null}
          </div>
        }
      />
      <PageBody>
        {justProposed ? (
          <div className="border-success/30 bg-success/10 mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm">
            <CheckCircle2 className="text-success mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink">
              Campaign sent to the committee. Once they approve it, every resident can see it and
              contribute.
            </p>
          </div>
        ) : null}

        {mine.length ? (
          <>
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">
              Proposed by you <Badge tone="warning">Awaiting committee</Badge>
            </h2>
            <div className="mb-8 space-y-3">{mine.map(card)}</div>
          </>
        ) : null}

        {live.length === 0 && past.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No events yet"
              description={
                staff
                  ? 'Create the first one with its budget, then publish it.'
                  : 'When the society plans something, it will appear here.'
              }
            />
          </Card>
        ) : null}

        {live.length ? (
          <>
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">Upcoming and open</h2>
            <div className="space-y-3">
              {live.sort((a, b) => a.starts_on.localeCompare(b.starts_on)).map(card)}
            </div>
          </>
        ) : null}
        {past.length ? (
          <>
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Past</h2>
            <div className="space-y-3">{past.map(card)}</div>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
