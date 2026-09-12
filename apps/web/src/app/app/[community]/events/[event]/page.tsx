import Link from 'next/link';
import {
  ArrowLeft,
  ClipboardList,
  FileText,
  HandHeart,
  Receipt,
  Settings2,
  Sparkles,
} from 'lucide-react';
import {
  FUND_RULE_LABEL,
  TASK_STATUS_DOT,
  TASK_STATUS_LABEL,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
  listSentence,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import {
  getActivities,
  getEventStats,
  getExpenses,
  getMyParticipation,
  getTasks,
  getVolunteerRoles,
  requireEvent,
} from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  EventStatusBadge,
  ExpenseStatusBadge,
  FundBar,
  ReadinessBar,
  StatTile,
} from '@/components/badges';
import { JoinActivityForm, VolunteerForm } from './participation-forms';

export default async function EventDetailPage(props: PageProps<'/app/[community]/events/[event]'>) {
  const { community: slug, event: eventSlug } = await props.params;
  const { community, role, membership } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);

  const [stats, tasks, activities, roles, expenses, mine] = await Promise.all([
    getEventStats(event.id),
    getTasks(event.id),
    getActivities(event.id),
    getVolunteerRoles(event.id),
    getExpenses(event.id),
    getMyParticipation(event.id, membership.id),
  ]);

  const base = `/app/${community.slug}`;
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const isStaff = can(role, 'events:prepare');
  const open = event.status === 'published';

  // Residents only ever receive approved rows; the committee sees the rest.
  const approved = expenses.filter((expense) => expense.status === 'approved');
  const awaiting = expenses.filter((expense) => expense.status !== 'approved');

  return (
    <>
      <PageHeader
        title={`${event.emoji} ${event.name}`}
        description={[
          formatDate(event.starts_on),
          event.venue,
          countdown(event.starts_on),
          event.organizer ? `by ${event.organizer}` : null,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex items-center gap-2">
            <EventStatusBadge status={event.status} />
            {isStaff ? (
              <ButtonLink href={`${base}/admin/events/${event.slug}`} size="sm" variant="secondary">
                <Settings2 className="size-4" aria-hidden="true" />
                Manage
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <PageBody>
        <Link
          href={`${base}/events`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All events
        </Link>

        {event.description ? (
          <p className="text-ink-muted mb-5 max-w-2xl text-sm leading-relaxed">
            {event.description}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {/* -------------------------------------------------- readiness */}
          <Card>
            <CardHeader
              title="Readiness"
              action={<span className="text-accent text-sm font-semibold">{stats.readiness}%</span>}
            />
            <CardBody>
              <ReadinessBar percent={stats.readiness} />
              <p className="text-ink-muted mt-2 text-sm">
                {stats.tasksDone} of {stats.tasksTotal} tasks complete
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile label="Performing" value={String(stats.participants)} />
                <StatTile label="Volunteering" value={String(stats.volunteers)} />
                <StatTile label="Contributed" value={String(stats.contributors)} />
              </div>
            </CardBody>
          </Card>

          {/* ------------------------------------------------------- fund */}
          <Card>
            <CardHeader
              title="Fund"
              description={FUND_RULE_LABEL[event.fund_rule]}
              action={<span className="text-success text-sm font-semibold">{funded}%</span>}
            />
            <CardBody>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-ink text-2xl font-semibold tracking-tight">
                    {formatMoney(stats.fundRaised, community.currency)}
                  </p>
                  <p className="text-ink-muted text-sm">
                    of {formatMoney(stats.fundTarget, community.currency)} target
                  </p>
                </div>
                {mine.contributed > 0 ? (
                  <Badge tone="success">
                    You gave {formatMoney(mine.contributed, community.currency)}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-3">
                <FundBar percent={funded} />
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <StatTile
                  label="Raised"
                  value={formatMoney(stats.fundRaised, community.currency)}
                />
                <StatTile label="Spent" value={formatMoney(stats.spent, community.currency)} />
                <StatTile
                  label="Available"
                  value={formatMoney(stats.available, community.currency)}
                  tone={stats.available < 0 ? 'danger' : 'success'}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <ButtonLink
                  href={`${base}/events/${event.slug}/accounts`}
                  size="sm"
                  variant="secondary"
                >
                  <Receipt className="size-4" aria-hidden="true" />
                  View the ledger
                </ButtonLink>
                {open ? (
                  <ButtonLink href={`${base}/events/${event.slug}/contribute`} size="sm">
                    Contribute
                  </ButtonLink>
                ) : null}
              </div>
            </CardBody>
          </Card>
        </div>

        {/* ------------------------------------------------------ activities */}
        <section id="activities" className="mt-8 scroll-mt-20">
          <h2 className="text-ink-soft mb-3 text-sm font-semibold">Cultural activities</h2>
          {activities.length ? (
            <div className="space-y-3">
              {activities.map((activity) => {
                const joined = mine.activities.includes(activity.id);
                const full = activity.capacity !== null && activity.interested >= activity.capacity;
                return (
                  <Card key={activity.id}>
                    <CardBody>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-semibold">
                            <span className="mr-1.5">{activity.emoji}</span>
                            {activity.name}
                          </p>
                          {activity.description ? (
                            <p className="text-ink-muted mt-1 text-sm">{activity.description}</p>
                          ) : null}
                          <p className="text-ink-subtle mt-1.5 text-xs">
                            {activity.interested} interested
                            {activity.capacity ? ` of ${activity.capacity} places` : ''}
                            {activity.memberships?.profiles?.full_name
                              ? ` · coordinated by ${activity.memberships.profiles.full_name}`
                              : ''}
                            {activity.practice_dates.length
                              ? ` · rehearsals ${listSentence(
                                  activity.practice_dates.map((date) => formatDate(date)),
                                )}`
                              : ''}
                          </p>
                        </div>
                        {full && !joined ? <Badge tone="neutral">Full</Badge> : null}
                      </div>

                      {open && activity.is_open && (!full || joined) ? (
                        <div className="border-border-base mt-3 border-t pt-3">
                          <JoinActivityForm
                            slug={slug}
                            eventSlug={event.slug}
                            activityId={activity.id}
                            activityName={activity.name}
                            joined={joined}
                          />
                        </div>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<Sparkles className="size-6" />}
                title="No activities yet"
                description="The committee hasn’t opened any performances for this event."
              />
            </Card>
          )}
        </section>

        {/* ------------------------------------------------------ volunteers */}
        <section id="volunteer" className="mt-8 scroll-mt-20">
          <h2 className="text-ink-soft mb-3 text-sm font-semibold">Volunteers</h2>
          {roles.length ? (
            <div className="space-y-3">
              {roles.map((volunteerRole) => {
                const signedUp = mine.roles.includes(volunteerRole.id);
                return (
                  <Card key={volunteerRole.id}>
                    <CardBody className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold">
                          <span className="mr-1.5">{volunteerRole.emoji}</span>
                          {volunteerRole.name}
                        </p>
                        <p className="text-ink-subtle mt-0.5 text-xs">
                          {volunteerRole.signedUp} of {volunteerRole.target_count} signed up
                          {volunteerRole.stillNeeded > 0
                            ? ` · ${volunteerRole.stillNeeded} more needed`
                            : ' · fully staffed'}
                          {volunteerRole.memberships?.profiles?.full_name
                            ? ` · ${volunteerRole.memberships.profiles.full_name} coordinating`
                            : ''}
                        </p>
                      </div>
                      {open ? (
                        <VolunteerForm
                          slug={slug}
                          eventSlug={event.slug}
                          roleId={volunteerRole.id}
                          signedUp={signedUp}
                          stillNeeded={volunteerRole.stillNeeded}
                        />
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <EmptyState
                icon={<HandHeart className="size-6" />}
                title="No volunteer roles yet"
                description="Nothing needs hands just now."
              />
            </Card>
          )}
        </section>

        {/* ------------------------------------------------------- checklist */}
        <section className="mt-8">
          <h2 className="text-ink-soft mb-3 text-sm font-semibold">Checklist</h2>
          <Card>
            {tasks.length ? (
              <ul className="divide-border-base divide-y">
                {tasks.map((task) => (
                  <li key={task.id} className="flex items-start gap-3 px-5 py-3">
                    <span aria-hidden="true">{TASK_STATUS_DOT[task.status]}</span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          task.status === 'done'
                            ? 'text-ink-muted text-sm line-through'
                            : 'text-ink text-sm'
                        }
                      >
                        {task.name}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        <span className="sr-only">{TASK_STATUS_LABEL[task.status]}. </span>
                        {task.memberships?.profiles?.full_name ?? 'Unassigned'}
                        {task.due_on ? ` · due ${formatDate(task.due_on)}` : ''}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<ClipboardList className="size-6" />}
                title="No tasks yet"
                description="The committee hasn’t built the checklist for this event."
              />
            )}
          </Card>
        </section>

        {/* ---------------------------------------------------------- ledger */}
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-ink-soft text-sm font-semibold">Where the money went</h2>
            <Link
              href={`${base}/events/${event.slug}/accounts`}
              className="text-accent text-sm hover:underline"
            >
              Full ledger
            </Link>
          </div>
          <Card>
            {approved.length ? (
              <ul className="divide-border-base divide-y">
                {approved.slice(0, 5).map((expense) => (
                  <li
                    key={expense.id}
                    className="flex items-center justify-between gap-3 px-5 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{expense.name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {expense.vendor ?? 'Vendor not recorded'}
                        {expense.approver?.profiles?.full_name
                          ? ` · approved by ${expense.approver.profiles.full_name}`
                          : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-ink text-sm font-semibold">
                        {formatMoney(expense.amount, community.currency)}
                      </span>
                      {expense.bill_url ? (
                        <span
                          className="text-ink-muted inline-flex items-center gap-1 text-xs"
                          title="A bill is attached"
                        >
                          <FileText className="size-3.5" aria-hidden="true" />
                          Bill
                        </span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Receipt className="size-6" />}
                title="Nothing spent yet"
                description="Approved expenses appear here with their bills, for everyone to see."
              />
            )}

            {isStaff && awaiting.length ? (
              <CardBody className="border-border-base border-t">
                <p className="text-ink-subtle mb-2 text-xs font-medium">
                  Not yet in the resident ledger
                </p>
                <ul className="space-y-2">
                  {awaiting.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between gap-3">
                      <span className="text-ink-muted text-sm">
                        {expense.name} · {formatMoney(expense.amount, community.currency)}
                      </span>
                      <ExpenseStatusBadge status={expense.status} />
                    </li>
                  ))}
                </ul>
              </CardBody>
            ) : null}
          </Card>

          {event.fund_rule_note ? (
            <p className="border-border-base bg-surface-sunken text-ink-muted mt-3 rounded-lg border px-4 py-3 text-sm">
              🔒 {event.fund_rule_note}
            </p>
          ) : null}
        </section>
      </PageBody>
    </>
  );
}
