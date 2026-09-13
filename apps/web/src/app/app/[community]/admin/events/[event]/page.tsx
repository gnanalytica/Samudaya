import Link from 'next/link';
import { ArrowLeft, FileText, Receipt, Sparkles, Wallet } from 'lucide-react';
import { can, formatDate, formatMoney, fundedPercent, receiptRef, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import {
  budgetVsSpent,
  getActivities,
  getBudgetLines,
  getEventStats,
  getExpenses,
  getPayments,
  getRegistrations,
  requireEvent,
} from '@/lib/events';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, ExpenseStatusBadge, FundBar, StatTile } from '@/components/badges';
import { BillLink } from '@/components/bill-link';
import {
  AddActivityForm,
  AddBudgetLineForm,
  CloseEventForm,
  EventDetailsForm,
  ExpenseForm,
  RecordPaymentForm,
  ReviewExpenseForm,
} from './forms';
import { removeBudgetLine, setEventStatus, updateActivity, updateBudgetLine } from '../actions';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'budget', label: 'Budget' },
  { key: 'activities', label: 'Activities' },
  { key: 'bills', label: 'Bills' },
  { key: 'payments', label: 'Payments' },
  { key: 'close', label: 'Close' },
] as const;

export default async function ManageEventPage(
  props: PageProps<'/app/[community]/admin/events/[event]'>,
) {
  const { community: slug, event: eventSlug } = await props.params;
  const { tab } = await props.searchParams;
  const { community, role } = await requireCapability(slug, 'events:manage');
  const event = await requireEvent(community.id, eventSlug);
  const supabase = await getSupabase();

  const isCommittee = can(role, 'expenses:approve');
  const tabs = TABS.filter((t) => t.key !== 'close' || can(role, 'events:close')).filter(
    (t) => event.kind !== 'campaign' || (t.key !== 'budget' && t.key !== 'activities'),
  );
  const active = tabs.find((t) => t.key === tab)?.key ?? 'overview';
  const base = `/app/${community.slug}`;
  const here = `${base}/admin/events/${event.slug}`;

  const [stats, budget, expenses, activities, registrations, payments, units] = await Promise.all([
    getEventStats(event.id),
    getBudgetLines(event.id),
    getExpenses(event.id),
    getActivities(event.id),
    getRegistrations(event.id),
    getPayments(event.id),
    supabase
      .from('units')
      .select('id, block, number')
      .eq('community_id', community.id)
      .order('block', { nullsFirst: true })
      .order('number')
      .limit(2000),
  ]);

  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const closed = event.status === 'completed';
  const open = expenses.filter((e) => e.status === 'pending' || e.status === 'changes_requested');
  const decided = expenses.filter((e) => e.status === 'approved' || e.status === 'rejected');
  const categories = budgetVsSpent(budget, expenses);
  const flatsPaid = new Set(
    payments.filter((payment) => payment.units).map((payment) => unitLabel(payment.units)),
  ).size;

  return (
    <>
      <PageHeader
        title={`${event.emoji} ${event.name}`}
        description={[
          event.kind === 'campaign' ? 'Fundraising campaign' : null,
          formatDate(event.starts_on),
          event.venue,
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {event.status === 'draft' ? (
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
          Console
        </Link>

        <nav
          aria-label="Event sections"
          className="border-border-base bg-surface-raised mb-5 flex gap-1 overflow-x-auto rounded-lg border p-1 text-sm"
        >
          {tabs.map((t) => (
            <Link
              key={t.key}
              href={`${here}?tab=${t.key}`}
              aria-current={active === t.key ? 'page' : undefined}
              className={
                active === t.key
                  ? 'bg-surface-sunken text-ink rounded-md px-3 py-1.5 font-medium whitespace-nowrap'
                  : 'text-ink-muted hover:text-ink rounded-md px-3 py-1.5 whitespace-nowrap'
              }
            >
              {t.label}
              {t.key === 'bills' && open.length ? (
                <span className="bg-warning/20 text-warning ml-1.5 rounded-full px-1.5 text-xs">
                  {open.length}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {active === 'overview' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Raised" value={formatMoney(stats.fundRaised, community.currency)} />
              <StatTile label="Spent" value={formatMoney(stats.spent, community.currency)} />
              <StatTile label="Flats paid" value={String(flatsPaid)} />
              <StatTile label="Registered" value={String(registrations.length)} />
            </div>
            <Card>
              <CardBody>
                <div className="text-ink-muted flex justify-between text-sm font-medium">
                  <span>Target {formatMoney(stats.fundTarget, community.currency)}</span>
                  <span>{funded}%</span>
                </div>
                <div className="mt-2">
                  <FundBar percent={funded} />
                </div>
              </CardBody>
            </Card>
            <Card>
              <CardHeader title="Details" />
              <CardBody>
                <EventDetailsForm slug={slug} event={event} />
              </CardBody>
            </Card>
            {event.status === 'published' || event.status === 'draft' ? (
              <Card>
                <CardHeader
                  title="Status"
                  description={
                    event.status === 'published'
                      ? 'Residents can see this event and contribute.'
                      : 'Only staff and the committee can see a draft.'
                  }
                />
                <CardBody className="flex flex-wrap gap-2">
                  {event.status === 'published' ? (
                    <form action={setEventStatus}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="event" value={event.slug} />
                      <input type="hidden" name="status" value="draft" />
                      <Button type="submit" size="sm" variant="secondary">
                        Move back to draft
                      </Button>
                    </form>
                  ) : null}
                  <form action={setEventStatus}>
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="event" value={event.slug} />
                    <input type="hidden" name="status" value="cancelled" />
                    <Button type="submit" size="sm" variant="ghost">
                      Cancel event
                    </Button>
                  </form>
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {active === 'budget' ? (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="Budget"
                description={`The fund target is the total of these lines: ${formatMoney(
                  stats.fundTarget,
                  community.currency,
                )}.`}
              />
              {budget.length ? (
                <ul className="divide-border-base divide-y">
                  {budget.map((line) => {
                    const spent =
                      categories.find(
                        (row) => row.label.toLowerCase() === line.category.trim().toLowerCase(),
                      )?.spent ?? 0;
                    return (
                      <li key={line.id} className="px-5 py-3">
                        <form
                          action={updateBudgetLine}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="event" value={event.slug} />
                          <input type="hidden" name="line_id" value={line.id} />
                          <label className="sr-only" htmlFor={`cat-${line.id}`}>
                            Category
                          </label>
                          <Input
                            id={`cat-${line.id}`}
                            name="category"
                            defaultValue={line.category}
                            className="min-w-36 flex-1"
                            disabled={closed}
                          />
                          <label className="sr-only" htmlFor={`amt-${line.id}`}>
                            Amount
                          </label>
                          <Input
                            id={`amt-${line.id}`}
                            name="amount"
                            type="number"
                            min={0}
                            defaultValue={Number(line.amount)}
                            className="w-32"
                            disabled={closed}
                          />
                          <span className="text-ink-subtle w-36 text-xs">
                            Spent {formatMoney(spent, community.currency)}
                          </span>
                          {!closed ? (
                            <>
                              <Button type="submit" size="sm" variant="secondary">
                                Save
                              </Button>
                              <Button
                                type="submit"
                                size="sm"
                                variant="ghost"
                                formAction={removeBudgetLine}
                              >
                                Remove
                              </Button>
                            </>
                          ) : null}
                        </form>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<Wallet className="size-6" />}
                  title="No budget yet"
                  description="Add what you plan to spend, category by category."
                />
              )}
              {!closed ? (
                <CardBody className="border-border-base border-t">
                  <AddBudgetLineForm slug={slug} eventSlug={event.slug} />
                </CardBody>
              ) : null}
            </Card>
          </div>
        ) : null}

        {active === 'activities' ? (
          <div className="space-y-5">
            {activities.length ? (
              activities.map((activity) => {
                const people = registrations.filter((r) => r.activity_id === activity.id);
                return (
                  <Card key={activity.id}>
                    <CardHeader
                      title={`${activity.emoji} ${activity.name}`}
                      description={`${people.length} registered${
                        activity.capacity ? ` of ${activity.capacity} places` : ''
                      }${activity.is_open ? '' : ' · registrations closed'}`}
                      action={
                        <form action={updateActivity} className="flex gap-2">
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="event" value={event.slug} />
                          <input type="hidden" name="activity_id" value={activity.id} />
                          <Button
                            type="submit"
                            size="sm"
                            variant="secondary"
                            name="intent"
                            value={activity.is_open ? 'close' : 'open'}
                          >
                            {activity.is_open ? 'Close registrations' : 'Reopen'}
                          </Button>
                          {people.length === 0 ? (
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              name="intent"
                              value="remove"
                            >
                              Remove
                            </Button>
                          ) : null}
                        </form>
                      }
                    />
                    {people.length ? (
                      <ul className="divide-border-base divide-y">
                        {people.map((person) => (
                          <li
                            key={person.id}
                            className="flex justify-between gap-3 px-5 py-2 text-sm"
                          >
                            <span className="text-ink">
                              {person.participant_name ??
                                person.memberships?.profiles?.full_name ??
                                'Resident'}
                            </span>
                            <span className="text-ink-subtle text-xs">
                              {person.participant_name && person.memberships?.profiles?.full_name
                                ? `registered by ${person.memberships.profiles.full_name}`
                                : formatDate(person.joined_at.slice(0, 10))}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </Card>
                );
              })
            ) : (
              <Card>
                <EmptyState
                  icon={<Sparkles className="size-6" />}
                  title="No activities yet"
                  description="Add performances, contests or games residents can register for."
                />
              </Card>
            )}
            <Card>
              <CardHeader title="Add an activity" />
              <CardBody>
                <AddActivityForm slug={slug} eventSlug={event.slug} />
              </CardBody>
            </Card>
          </div>
        ) : null}

        {active === 'bills' ? (
          <div className="space-y-5">
            {open.length ? (
              <Card className="border-warning/40">
                <CardHeader
                  title="Waiting for the committee"
                  description={
                    isCommittee
                      ? 'Approve to publish a bill to residents. Nobody approves a bill they uploaded.'
                      : 'Correct or re-upload a bill while it is pending or sent back.'
                  }
                />
                <ul className="divide-border-base divide-y">
                  {open.map((expense) => (
                    <li key={expense.id} className="space-y-3 px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-semibold">
                            {expense.name} · {formatMoney(expense.amount, community.currency)}
                          </p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {[expense.category, expense.vendor, formatDate(expense.spent_on)]
                              .filter(Boolean)
                              .join(' · ')}
                            {expense.requester?.profiles?.full_name
                              ? ` · uploaded by ${expense.requester.profiles.full_name}`
                              : ''}
                          </p>
                          {expense.review_note ? (
                            <p className="text-info mt-1 text-xs">
                              Committee: {expense.review_note}
                            </p>
                          ) : null}
                          <BillLink url={expense.bill_url} />
                        </div>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                      {isCommittee && expense.status === 'pending' ? (
                        <ReviewExpenseForm
                          slug={slug}
                          eventSlug={event.slug}
                          expenseId={expense.id}
                        />
                      ) : null}
                      {!closed ? (
                        <details className="group">
                          <summary className="text-accent cursor-pointer text-sm">
                            Correct or re-upload
                          </summary>
                          <div className="mt-3">
                            <ExpenseForm
                              slug={slug}
                              eventSlug={event.slug}
                              expense={{
                                id: expense.id,
                                name: expense.name,
                                category: expense.category,
                                amount: Number(expense.amount),
                                vendor: expense.vendor,
                                paid_by: expense.paid_by,
                                method: expense.method,
                                bill_url: expense.bill_url,
                                spent_on: expense.spent_on,
                              }}
                            />
                          </div>
                        </details>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card>
              <CardHeader title={`Decided (${decided.length})`} />
              {decided.length ? (
                <ul className="divide-border-base divide-y">
                  {decided.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium">{expense.name}</p>
                        <p className="text-ink-subtle text-xs">
                          {[expense.category, expense.vendor].filter(Boolean).join(' · ')}
                          {expense.approver?.profiles?.full_name
                            ? ` · approved by ${expense.approver.profiles.full_name}`
                            : ''}
                        </p>
                        <BillLink url={expense.bill_url} />
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-ink text-sm font-semibold">
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
                  title="No decided bills yet"
                  description="Approved bills appear in every resident’s spending list."
                />
              )}
            </Card>

            {!closed ? (
              <Card>
                <CardHeader title="Upload a bill" />
                <CardBody>
                  <ExpenseForm slug={slug} eventSlug={event.slug} />
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}

        {active === 'payments' ? (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile
                label="Collected"
                value={formatMoney(stats.fundRaised, community.currency)}
              />
              <StatTile label="Payments" value={String(payments.length)} />
              <StatTile label="Flats paid" value={String(flatsPaid)} />
            </div>
            {event.status === 'published' && can(role, 'payments:record') ? (
              <Card>
                <CardHeader
                  title="Record a payment"
                  description="Cash, UPI to the society account or a cheque, collected from a flat."
                />
                <CardBody>
                  <RecordPaymentForm
                    slug={slug}
                    eventSlug={event.slug}
                    units={(units.data ?? []).map((unit) => ({
                      id: unit.id,
                      label: unitLabel(unit),
                    }))}
                  />
                </CardBody>
              </Card>
            ) : null}
            <Card>
              <CardHeader
                title="Who paid"
                description="Every payment for this event, newest first."
              />
              {payments.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Flat
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Paid by
                        </th>
                        <th scope="col" className="px-5 py-2.5 text-right font-medium">
                          Amount
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Method
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Reference
                        </th>
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-border-base divide-y">
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td className="text-ink px-5 py-3 font-medium">
                            {unitLabel(payment.units)}
                          </td>
                          <td className="text-ink-muted px-5 py-3">
                            {payment.memberships?.profiles?.full_name ?? (
                              <Badge tone="neutral">Recorded by staff</Badge>
                            )}
                          </td>
                          <td className="text-ink px-5 py-3 text-right font-medium">
                            {formatMoney(payment.amount, community.currency)}
                          </td>
                          <td className="text-ink-muted px-5 py-3 uppercase">{payment.method}</td>
                          <td className="text-ink-subtle px-5 py-3 font-mono text-xs">
                            {payment.reference ?? receiptRef(event.slug, payment.receipt_no)}
                          </td>
                          <td className="text-ink-subtle px-5 py-3 text-xs">
                            {formatDate(payment.paid_at.slice(0, 10))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Wallet className="size-6" />}
                  title="No payments yet"
                  description="Payments made in the app and recorded by staff appear here."
                />
              )}
            </Card>
          </div>
        ) : null}

        {active === 'close' ? (
          closed ? (
            <Card>
              <EmptyState
                icon={<FileText className="size-6" />}
                title="This event is closed"
                description="Its accounts are published and the ledger is frozen."
              />
            </Card>
          ) : (
            <CloseEventForm
              slug={slug}
              eventSlug={event.slug}
              eventName={event.name}
              openBills={open.length}
            />
          )
        ) : null}
      </PageBody>
    </>
  );
}
