import Link from 'next/link';
import { CalendarDays, KeyRound, Plus, Receipt, Ticket, UserPlus, Users } from 'lucide-react';
import { can, formatDate, formatMoney, fundedPercent } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { listEvents, getStatsFor } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar, ReadinessBar, StatTile } from '@/components/badges';

export const metadata = { title: 'Admin console' };

export default async function AdminConsolePage(props: PageProps<'/app/[community]/admin'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'events:prepare');
  const supabase = await getSupabase();

  const events = await listEvents(community.id);
  const stats = await getStatsFor(events.map((event) => event.id));
  const base = `/app/${community.slug}`;

  const [pendingRequests, pendingExpenses, memberCount] = await Promise.all([
    supabase
      .from('join_requests')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'pending'),
    supabase
      .from('expenses')
      .select('id, name, amount, vendor, events(slug, name)')
      .eq('community_id', community.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('memberships')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id)
      .eq('status', 'active'),
  ]);

  const live = events.filter((event) => event.status === 'published');
  const drafts = events.filter((event) => event.status === 'draft');

  return (
    <>
      <PageHeader
        title="Admin console"
        description={`${community.name} · Society ID ${community.join_code}`}
        action={
          <ButtonLink href={`${base}/admin/events/new`} size="sm">
            <Plus className="size-4" aria-hidden="true" />
            Create event
          </ButtonLink>
        }
      />
      <PageBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Live events" value={String(live.length)} />
          <StatTile label="Drafts" value={String(drafts.length)} />
          <StatTile label="Members" value={String(memberCount.count ?? 0)} />
          <StatTile
            label="Needs you"
            value={String((pendingRequests.count ?? 0) + (pendingExpenses.data?.length ?? 0))}
            tone={
              (pendingRequests.count ?? 0) + (pendingExpenses.data?.length ?? 0) > 0
                ? 'danger'
                : undefined
            }
          />
        </div>

        {/* Anything waiting on a human decision comes first. */}
        {(pendingRequests.count ?? 0) > 0 || pendingExpenses.data?.length ? (
          <Card className="border-warning/40 mt-5">
            <CardHeader title="Waiting on you" />
            <ul className="divide-border-base divide-y">
              {(pendingRequests.count ?? 0) > 0 && can(role, 'joinrequests:review') ? (
                <li className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="text-ink flex items-center gap-2 text-sm">
                    <UserPlus className="text-ink-muted size-4" aria-hidden="true" />
                    {pendingRequests.count} resident
                    {pendingRequests.count === 1 ? '' : 's'} waiting to join
                  </span>
                  <Link
                    href={`${base}/admin/requests`}
                    className="text-accent shrink-0 text-sm hover:underline"
                  >
                    Review
                  </Link>
                </li>
              ) : null}
              {(pendingExpenses.data ?? []).map((expense) => (
                <li key={expense.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="text-ink flex items-center gap-2 text-sm">
                      <Receipt className="text-ink-muted size-4" aria-hidden="true" />
                      {expense.name} · {formatMoney(expense.amount, community.currency)}
                    </span>
                    <span className="text-ink-subtle mt-0.5 block pl-6 text-xs">
                      {expense.vendor ?? 'No vendor'} · {expense.events?.name}
                    </span>
                  </span>
                  {expense.events?.slug ? (
                    <Link
                      href={`${base}/admin/events/${expense.events.slug}?tab=expenses`}
                      className="text-accent shrink-0 text-sm hover:underline"
                    >
                      Review
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Events</h2>
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
                        {formatDate(event.starts_on)}
                        {event.venue ? ` · ${event.venue}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {(s?.pendingExpenses ?? 0) > 0 ? (
                        <Badge tone="warning">{s?.pendingExpenses} to approve</Badge>
                      ) : null}
                      <EventStatusBadge status={event.status} />
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                        <span>
                          Readiness · {s?.tasksDone ?? 0}/{s?.tasksTotal ?? 0}
                        </span>
                        <span>{s?.readiness ?? 0}%</span>
                      </div>
                      <ReadinessBar percent={s?.readiness ?? 0} />
                    </div>
                    <div>
                      <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                        <span>
                          {formatMoney(s?.fundRaised ?? 0, community.currency)} raised ·{' '}
                          {formatMoney(s?.spent ?? 0, community.currency)} spent
                        </span>
                        <span>{funded}%</span>
                      </div>
                      <FundBar percent={funded} />
                    </div>
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
              description="The wizard walks through budget, checklist and surplus rule in seven steps."
              action={
                <ButtonLink href={`${base}/admin/events/new`} size="sm">
                  Create your first event
                </ButtonLink>
              }
            />
          </Card>
        )}

        <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Manage</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              href: `${base}/admin/requests`,
              label: 'Join requests',
              icon: UserPlus,
              cap: 'joinrequests:review' as const,
            },
            {
              href: `${base}/admin/members`,
              label: 'Members',
              icon: Users,
              cap: 'members:manage' as const,
            },
            {
              href: `${base}/admin/invites`,
              label: 'Invite codes',
              icon: Ticket,
              cap: 'invites:manage' as const,
            },
            {
              href: `${base}/admin/api-keys`,
              label: 'API & AI access',
              icon: KeyRound,
              cap: 'apikeys:manage' as const,
            },
          ]
            .filter((item) => can(role, item.cap))
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
            title="Share your Society ID"
            description="Residents enter this, pick their flat, and you approve them."
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
