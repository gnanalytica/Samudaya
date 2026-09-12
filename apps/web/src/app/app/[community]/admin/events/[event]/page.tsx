import Link from 'next/link';
import { ArrowLeft, ClipboardList, HandHeart, Receipt, Sparkles } from 'lucide-react';
import {
  FUND_RULE_LABEL,
  TASK_STATUS_LABEL,
  can,
  formatDate,
  formatMoney,
  fundedPercent,
} from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import {
  getActivities,
  getEventStats,
  getExpenses,
  getTasks,
  getVolunteerRoles,
  requireEvent,
} from '@/lib/events';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  EventStatusBadge,
  ExpenseStatusBadge,
  FundBar,
  ReadinessBar,
  StatTile,
} from '@/components/badges';
import { AddActivityForm, AddExpenseForm, AddRoleForm, AddTaskForm, CloseEventForm } from './forms';
import { reviewExpense, setEventStatus, updateTask } from '../actions';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Checklist' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'people', label: 'People' },
  { key: 'close', label: 'Close' },
] as const;

export default async function ManageEventPage(
  props: PageProps<'/app/[community]/admin/events/[event]'>,
) {
  const { community: slug, event: eventSlug } = await props.params;
  const { tab } = await props.searchParams;
  const { community, role, membership } = await requireCapability(slug, 'events:prepare');
  const event = await requireEvent(community.id, eventSlug);
  const supabase = await getSupabase();

  const active = typeof tab === 'string' && TABS.some((t) => t.key === tab) ? tab : 'overview';
  const base = `/app/${community.slug}`;
  const isAdmin = can(role, 'events:publish');

  const [stats, tasks, expenses, activities, roles, members] = await Promise.all([
    getEventStats(event.id),
    getTasks(event.id),
    getExpenses(event.id),
    getActivities(event.id),
    getVolunteerRoles(event.id),
    supabase
      .from('memberships')
      .select('id, profiles(full_name)')
      .eq('community_id', community.id)
      .eq('status', 'active')
      .limit(200),
  ]);

  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const pending = expenses.filter((expense) => expense.status === 'pending');
  const closed = event.status === 'completed';

  return (
    <>
      <PageHeader
        title={`${event.emoji} ${event.name}`}
        description={[formatDate(event.starts_on), event.venue].filter(Boolean).join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {isAdmin && event.status === 'draft' ? (
              <form action={setEventStatus}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="event" value={event.slug} />
                <input type="hidden" name="status" value="published" />
                <Button type="submit" size="sm">
                  Publish to residents
                </Button>
              </form>
            ) : null}
            {event.status === 'published' ? (
              <ButtonLink href={`${base}/events/${event.slug}`} size="sm" variant="secondary">
                View as resident
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <PageBody>
        <Link
          href={`${base}/admin`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Admin console
        </Link>

        <nav className="border-border-base bg-surface-raised mb-5 flex gap-1 overflow-x-auto rounded-lg border p-1 text-sm">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={`${base}/admin/events/${event.slug}?tab=${item.key}`}
              aria-current={active === item.key ? 'page' : undefined}
              className={
                active === item.key
                  ? 'bg-surface-sunken text-ink rounded-md px-3 py-1.5 font-medium whitespace-nowrap'
                  : 'text-ink-muted hover:text-ink rounded-md px-3 py-1.5 whitespace-nowrap'
              }
            >
              {item.label}
              {item.key === 'expenses' && pending.length ? (
                <span className="bg-warning/20 text-warning ml-1.5 rounded-full px-1.5 text-xs">
                  {pending.length}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* ----------------------------------------------------- overview */}
        {active === 'overview' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Raised" value={formatMoney(stats.fundRaised, community.currency)} />
              <StatTile label="Spent" value={formatMoney(stats.spent, community.currency)} />
              <StatTile
                label="Available"
                value={formatMoney(stats.available, community.currency)}
                tone={stats.available < 0 ? 'danger' : 'success'}
              />
              <StatTile label="Ready" value={`${stats.readiness}%`} />
            </div>

            <Card>
              <CardBody className="space-y-4">
                <div>
                  <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                    <span>
                      Checklist · {stats.tasksDone}/{stats.tasksTotal}
                    </span>
                    <span>{stats.readiness}%</span>
                  </div>
                  <ReadinessBar percent={stats.readiness} />
                </div>
                <div>
                  <div className="text-ink-muted mb-1.5 flex justify-between text-xs font-medium">
                    <span>Fund · target {formatMoney(stats.fundTarget, community.currency)}</span>
                    <span>{funded}%</span>
                  </div>
                  <FundBar percent={funded} />
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Contributors</dt>
                    <dd className="text-ink font-medium">{stats.contributors}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Performing</dt>
                    <dd className="text-ink font-medium">{stats.participants}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Volunteering</dt>
                    <dd className="text-ink font-medium">{stats.volunteers}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Surplus rule</dt>
                    <dd className="text-ink text-right font-medium">
                      {FUND_RULE_LABEL[event.fund_rule]}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            {event.status === 'draft' ? (
              <Card className="border-brand-300">
                <CardBody>
                  <p className="text-ink text-sm font-medium">This event is still a draft.</p>
                  <p className="text-ink-muted mt-1 text-sm">
                    Residents cannot see it and the fund is closed. Finish the checklist, then
                    {isAdmin ? ' publish it.' : ' ask an admin to publish it.'}
                  </p>
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* -------------------------------------------------------- tasks */}
        {active === 'tasks' ? (
          <div className="space-y-5">
            {!closed ? (
              <Card>
                <CardBody>
                  <AddTaskForm slug={slug} eventSlug={event.slug} />
                </CardBody>
              </Card>
            ) : null}

            <Card>
              <CardHeader
                title="Checklist"
                description={`${stats.tasksDone} of ${stats.tasksTotal} complete`}
              />
              {tasks.length ? (
                <ul className="divide-border-base divide-y">
                  {tasks.map((task) => (
                    <li key={task.id} className="px-5 py-3">
                      <form
                        action={updateTask}
                        className="flex flex-wrap items-center justify-between gap-3"
                      >
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="event" value={event.slug} />
                        <input type="hidden" name="id" value={task.id} />

                        <div className="min-w-48 flex-1">
                          <p className="text-ink text-sm">{task.name}</p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {task.memberships?.profiles?.full_name ?? 'Unassigned'}
                            {task.due_on ? ` · due ${formatDate(task.due_on)}` : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <label htmlFor={`status-${task.id}`} className="sr-only">
                            Status of {task.name}
                          </label>
                          <Select
                            id={`status-${task.id}`}
                            name="status"
                            defaultValue={task.status}
                            className="h-8 py-1 text-xs"
                            disabled={closed}
                          >
                            {Object.entries(TASK_STATUS_LABEL).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>

                          <label htmlFor={`assignee-${task.id}`} className="sr-only">
                            Owner of {task.name}
                          </label>
                          <Select
                            id={`assignee-${task.id}`}
                            name="assignee_id"
                            defaultValue={task.memberships ? undefined : ''}
                            className="h-8 py-1 text-xs"
                            disabled={closed}
                          >
                            <option value="">Unassigned</option>
                            {(members.data ?? []).map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.profiles?.full_name ?? 'Member'}
                              </option>
                            ))}
                          </Select>

                          <Button type="submit" size="sm" variant="ghost" disabled={closed}>
                            Save
                          </Button>
                        </div>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<ClipboardList className="size-6" />}
                  title="No tasks yet"
                  description="Add the first one above."
                />
              )}
            </Card>
          </div>
        ) : null}

        {/* ----------------------------------------------------- expenses */}
        {active === 'expenses' ? (
          <div className="space-y-5">
            {pending.length ? (
              <Card className="border-warning/40">
                <CardHeader
                  title="Awaiting your decision"
                  description="Approving puts it in the resident ledger. You cannot approve your own."
                />
                <ul className="divide-border-base divide-y">
                  {pending.map((expense) => {
                    // review_expense refuses self-approval; say so up front
                    // rather than after a failed click.
                    const requestedByMe = expense.requested_by === membership.id;
                    return (
                      <li key={expense.id} className="px-5 py-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-ink text-sm font-semibold">
                              {expense.name} · {formatMoney(expense.amount, community.currency)}
                            </p>
                            <p className="text-ink-subtle mt-0.5 text-xs">
                              {expense.vendor ?? 'No vendor'} ·{' '}
                              {expense.requester?.profiles?.full_name ?? 'Someone'} asked ·{' '}
                              {formatDate(expense.spent_on)}
                            </p>
                            {expense.bill_url ? (
                              <p className="text-ink-subtle mt-0.5 font-mono text-xs">
                                📎 {expense.bill_url}
                              </p>
                            ) : (
                              <p className="text-danger mt-0.5 text-xs">No bill attached</p>
                            )}
                          </div>

                          {isAdmin ? (
                            <div className="flex flex-wrap gap-2">
                              {(requestedByMe
                                ? (['changes_requested', 'rejected'] as const)
                                : (['approved', 'changes_requested', 'rejected'] as const)
                              ).map((decision) => (
                                <form key={decision} action={reviewExpense}>
                                  <input type="hidden" name="slug" value={slug} />
                                  <input type="hidden" name="event" value={event.slug} />
                                  <input type="hidden" name="expense_id" value={expense.id} />
                                  <input type="hidden" name="decision" value={decision} />
                                  <Button
                                    type="submit"
                                    size="sm"
                                    variant={
                                      decision === 'approved'
                                        ? 'primary'
                                        : decision === 'rejected'
                                          ? 'danger'
                                          : 'secondary'
                                    }
                                  >
                                    {decision === 'approved'
                                      ? 'Approve'
                                      : decision === 'rejected'
                                        ? 'Reject'
                                        : 'Ask for changes'}
                                  </Button>
                                </form>
                              ))}
                            </div>
                          ) : (
                            <Badge tone="warning">Waiting for an admin</Badge>
                          )}
                        </div>
                        {requestedByMe ? (
                          <p className="text-ink-subtle mt-2 text-xs">
                            You submitted this, so another admin has to approve it.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </Card>
            ) : null}

            {!closed ? <AddExpenseForm slug={slug} eventSlug={event.slug} /> : null}

            <Card>
              <CardHeader title="Ledger" description={`${expenses.length} entries`} />
              {expenses.length ? (
                <ul className="divide-border-base divide-y">
                  {expenses.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm">{expense.name}</p>
                        <p className="text-ink-subtle mt-0.5 text-xs">
                          {expense.vendor ?? '—'}
                          {expense.approver?.profiles?.full_name
                            ? ` · approved by ${expense.approver.profiles.full_name}`
                            : ''}
                          {expense.review_note ? ` · “${expense.review_note}”` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-ink text-sm font-medium">
                          {formatMoney(expense.amount, community.currency)}
                        </span>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  icon={<Receipt className="size-6" />}
                  title="Nothing recorded yet"
                  description="Expenses you record here appear to residents once approved."
                />
              )}
            </Card>
          </div>
        ) : null}

        {/* ------------------------------------------------------- people */}
        {active === 'people' ? (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Cultural activities"
                description={`${stats.participants} residents performing`}
              />
              <CardBody className="border-border-base border-b">
                <AddActivityForm slug={slug} eventSlug={event.slug} />
              </CardBody>
              {activities.length ? (
                <ul className="divide-border-base divide-y">
                  {activities.map((activity) => (
                    <li
                      key={activity.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="text-ink text-sm">
                        {activity.emoji} {activity.name}
                      </span>
                      <span className="text-ink-muted text-sm">
                        {activity.interested} interested
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<Sparkles className="size-6" />} title="No activities yet" />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Volunteer roles"
                description={`${stats.volunteers} residents signed up`}
              />
              <CardBody className="border-border-base border-b">
                <AddRoleForm slug={slug} eventSlug={event.slug} />
              </CardBody>
              {roles.length ? (
                <ul className="divide-border-base divide-y">
                  {roles.map((volunteerRole) => (
                    <li
                      key={volunteerRole.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <span className="text-ink text-sm">
                        {volunteerRole.emoji} {volunteerRole.name}
                      </span>
                      <span className="text-ink-muted text-sm">
                        {volunteerRole.signedUp} of {volunteerRole.target_count}
                        {volunteerRole.stillNeeded > 0
                          ? ` · ${volunteerRole.stillNeeded} more needed`
                          : ' · full'}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={<HandHeart className="size-6" />} title="No roles yet" />
              )}
            </Card>
          </div>
        ) : null}

        {/* -------------------------------------------------------- close */}
        {active === 'close' ? (
          <div className="space-y-5">
            <Card>
              <CardHeader title="Final position" />
              <CardBody>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Collected</dt>
                    <dd className="text-ink font-medium">
                      {formatMoney(stats.fundRaised, community.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Spent (approved)</dt>
                    <dd className="text-ink font-medium">
                      {formatMoney(stats.spent, community.currency)}
                    </dd>
                  </div>
                  <div className="border-border-base flex justify-between gap-3 border-t pt-2.5">
                    <dt className="text-ink font-medium">Surplus</dt>
                    <dd
                      className={
                        stats.available < 0
                          ? 'text-danger font-semibold'
                          : 'text-success font-semibold'
                      }
                    >
                      {formatMoney(stats.available, community.currency)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Goes to</dt>
                    <dd className="text-ink text-right font-medium">
                      {event.fund_rule_note ?? FUND_RULE_LABEL[event.fund_rule]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Checklist</dt>
                    <dd className="text-ink font-medium">
                      {stats.tasksDone} of {stats.tasksTotal}
                    </dd>
                  </div>
                </dl>
              </CardBody>
            </Card>

            {closed ? (
              <Card>
                <CardBody>
                  <p className="text-success text-sm font-medium">
                    This event is closed and its report is published.
                  </p>
                  <p className="text-ink-muted mt-1 text-sm">
                    Closed {formatDate((event.closed_at ?? '').slice(0, 10))}. The ledger is frozen.
                  </p>
                  <div className="mt-3">
                    <ButtonLink
                      href={`${base}/events/${event.slug}/accounts`}
                      size="sm"
                      variant="secondary"
                    >
                      View the report
                    </ButtonLink>
                  </div>
                </CardBody>
              </Card>
            ) : isAdmin ? (
              <CloseEventForm
                slug={slug}
                eventSlug={event.slug}
                eventName={event.name}
                pendingExpenses={pending.length}
              />
            ) : (
              <Card>
                <CardBody>
                  <p className="text-ink-muted text-sm">
                    Only an admin can close an event and publish its report.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
