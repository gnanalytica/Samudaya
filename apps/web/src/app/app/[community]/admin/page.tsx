import Link from 'next/link';
import { CalendarDays, ClipboardCheck, Plus, Receipt, UserPlus, Users } from 'lucide-react';
import { can, formatDate, formatMoney, fundedPercent } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { listEvents, getStatsFor } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar, StatTile } from '@/components/badges';

export const metadata = { title: 'Console' };

export default async function ConsolePage(props: PageProps<'/app/[community]/admin'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'events:manage');
  const supabase = await getSupabase();
  const committee = can(role, 'expenses:approve');

  const events = (await listEvents(community.id)).filter((event) => event.status !== 'proposed');
  const stats = await getStatsFor(events.map((event) => event.id));
  const base = `/app/${community.slug}`;

  const [requests, bills, sentBack, proposals, suggestions, members] = await Promise.all([
    supabase
      .from('join_requests')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'pending'),
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'pending'),
    supabase
      .from('expenses')
      .select('id, name, amount, events(slug, name)')
      .eq('community_id', community.id)
      .eq('status', 'changes_requested')
      .limit(10),
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'proposed'),
    supabase
      .from('activity_suggestions')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'new'),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'active'),
  ]);

  const waiting = [
    {
      show: (requests.count ?? 0) > 0,
      icon: UserPlus,
      text: `${requests.count} resident${requests.count === 1 ? '' : 's'} waiting to join`,
      href: `${base}/admin/requests`,
    },
    {
      show: committee && (bills.count ?? 0) + (proposals.count ?? 0) + (suggestions.count ?? 0) > 0,
      icon: ClipboardCheck,
      text: [
        bills.count ? `${bills.count} bill${bills.count === 1 ? '' : 's'}` : null,
        proposals.count ? `${proposals.count} campaign${proposals.count === 1 ? '' : 's'}` : null,
        suggestions.count
          ? `${suggestions.count} suggestion${suggestions.count === 1 ? '' : 's'}`
          : null,
      ]
        .filter(Boolean)
        .join(', ')
        .concat(' for the committee'),
      href: `${base}/admin/approvals`,
    },
    {
      show: !committee && (bills.count ?? 0) > 0,
      icon: Receipt,
      text: `${bills.count} bill${bills.count === 1 ? '' : 's'} waiting for the committee`,
      href: null,
    },
  ].filter((item) => item.show);

  return (
    <>
      <PageHeader
        title="Console"
        description={`${community.name} · society code ${community.join_code}`}
        action={
          <ButtonLink href={`${base}/admin/events/new`} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Create event
          </ButtonLink>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile
            label="Live"
            value={String(events.filter((event) => event.status === 'published').length)}
          />
          <StatTile
            label="Drafts"
            value={String(events.filter((event) => event.status === 'draft').length)}
          />
          <StatTile label="Members" value={String(members.count ?? 0)} />
          <StatTile
            label="Join requests"
            value={String(requests.count ?? 0)}
            tone={(requests.count ?? 0) > 0 ? 'danger' : undefined}
          />
        </div>

        {waiting.length || sentBack.data?.length ? (
          <Card className="border-warning/40 mt-5">
            <CardHeader title="Needs attention" />
            <ul className="divide-border-base divide-y">
              {waiting.map(({ icon: Icon, text, href }) => (
                <li key={text} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-ink flex items-center gap-2 text-sm">
                    <Icon className="text-ink-muted size-4" aria-hidden="true" />
                    {text}
                  </span>
                  {href ? (
                    <Link href={href} className="text-accent shrink-0 text-sm hover:underline">
                      Review
                    </Link>
                  ) : null}
                </li>
              ))}
              {(sentBack.data ?? []).map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-ink flex items-center gap-2 text-sm">
                    <Receipt className="text-ink-muted size-4" aria-hidden="true" />
                    Sent back: {expense.name} · {formatMoney(expense.amount, community.currency)}
                    {expense.events?.name ? ` · ${expense.events.name}` : ''}
                  </span>
                  {expense.events?.slug ? (
                    <Link
                      href={`${base}/admin/events/${expense.events.slug}?tab=bills`}
                      className="text-accent shrink-0 text-sm hover:underline"
                    >
                      Correct
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Events and campaigns</h2>
        {events.length ? (
          <div className="space-y-3">
            {events.map((event) => {
              const s = stats.get(event.id);
              const funded = fundedPercent(s?.fundRaised ?? 0, s?.fundTarget ?? 0);
              return (
                <Link
                  key={event.id}
                  href={`${base}/admin/events/${event.slug}`}
                  className="border-border-base bg-surface-raised hover:bg-surface-sunken block rounded-xl border p-5 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink truncate text-base font-semibold">
                        <span className="mr-1.5">{event.emoji}</span>
                        {event.name}
                      </p>
                      <p className="text-ink-muted mt-0.5 text-sm">
                        {event.kind === 'campaign' ? 'Campaign · ' : ''}
                        {formatDate(event.starts_on)}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {(s?.pendingExpenses ?? 0) > 0 ? (
                        <Badge tone="warning">{s?.pendingExpenses} bills pending</Badge>
                      ) : null}
                      <EventStatusBadge status={event.status} />
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                      <span>
                        {formatMoney(s?.fundRaised ?? 0, community.currency)} raised ·{' '}
                        {formatMoney(s?.spent ?? 0, community.currency)} spent
                      </span>
                      <span>{funded}%</span>
                    </div>
                    <FundBar percent={funded} />
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="No events yet"
              description="Create one with its budget, then add activities and publish it."
              action={
                <ButtonLink href={`${base}/admin/events/new`} size="sm">
                  Create your first event
                </ButtonLink>
              }
            />
          </Card>
        )}

        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { href: `${base}/admin/requests`, label: 'Join requests', icon: UserPlus, show: true },
            { href: `${base}/admin/members`, label: 'Residents', icon: Users, show: true },
            {
              href: `${base}/admin/approvals`,
              label: 'Committee approvals',
              icon: ClipboardCheck,
              show: committee,
            },
          ]
            .filter((item) => item.show)
            .map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <Icon className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-medium">{label}</p>
              </Link>
            ))}
        </div>

        <Card className="mt-5">
          <CardHeader
            title="Society code"
            description="One code for every resident. They enter it with their flat, and staff approve them."
          />
          <CardBody>
            <p className="text-ink font-mono text-2xl font-semibold tracking-widest">
              {community.join_code}
            </p>
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
