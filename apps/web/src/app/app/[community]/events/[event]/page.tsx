import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  Lightbulb,
  MapPin,
  Receipt,
  Settings2,
  Sparkles,
  Tag,
  ThumbsDown,
  ThumbsUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  COPY,
  EVENT_TABS,
  FUND_RULE_LABEL,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
  receiptRef,
  type EventTab,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import {
  budgetVsSpent,
  getActivities,
  getBudgetLines,
  getEventStats,
  getExpenses,
  getMyParticipation,
  getRegistrations,
  getSuggestions,
  requireEvent,
} from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  EventStatusBadge,
  ExpenseStatusBadge,
  FundBar,
  PaymentStatusBadge,
  StatTile,
} from '@/components/badges';
import { getSupabase } from '@/lib/supabase/server';
import { BillLink } from '@/components/bill-link';
import { cn } from '@/lib/utils';
import { cancelRegistration, voteOnSuggestion } from '../actions';
import { RegisterForm, SuggestionForm } from './participation-forms';

/**
 * An event in four tabs: About, Money (the fund, budget against spending and
 * every approved bill), Activities to register for, and Vote.
 */
export default async function EventDetailPage(props: PageProps<'/app/[community]/events/[event]'>) {
  const { community: slug, event: eventSlug } = await props.params;
  const { tab } = await props.searchParams;
  const { community, role, membership } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);

  const supabase = await getSupabase();
  const [stats, budget, expenses, activities, registrations, suggestions, mine, myPayments] =
    await Promise.all([
      getEventStats(event.id),
      getBudgetLines(event.id),
      getExpenses(event.id),
      getActivities(event.id),
      getRegistrations(event.id),
      getSuggestions(event.id, membership.id),
      getMyParticipation(event.id, membership.id),
      supabase
        .from('contributions')
        .select('id, amount, status, method, reference, receipt_no, review_note, paid_at')
        .eq('event_id', event.id)
        .eq('membership_id', membership.id)
        .order('paid_at', { ascending: false }),
    ]);

  const base = `/app/${community.slug}`;
  const here = `${base}/events/${event.slug}`;
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const open = event.status === 'published';
  const isCampaign = event.kind === 'campaign';
  const isStaff = can(role, 'events:manage');
  const approved = expenses.filter((expense) => expense.status === 'approved');
  const awaiting = expenses.filter((expense) => expense.status !== 'approved');
  const categories = budgetVsSpent(budget, expenses);
  const plannedTotal = categories.reduce((sum, row) => sum + row.planned, 0);
  const largest = Math.max(1, ...categories.map((row) => Math.max(row.planned, row.spent)));
  const myRegistrations = registrations.filter((r) => r.membership_id === membership.id);
  const voting = suggestions.filter((s) => s.status === 'accepted');
  const mySuggestions = suggestions.filter(
    (s) => s.suggested_by === membership.id && s.status !== 'accepted',
  );

  // Campaigns have no activities; a proposed campaign has nothing to vote on yet.
  const tabs = EVENT_TABS.filter(
    (t) =>
      !(t.id === 'activities' && isCampaign) && !(t.id === 'vote' && event.status === 'proposed'),
  );
  const active: EventTab = tabs.find((t) => t.id === tab)?.id ?? 'about';

  const eventType = event.event_type_id
    ? (await getCatalogue(community.id)).event_type.find((item) => item.id === event.event_type_id)
    : null;
  const canContribute = open && can(role, 'contribute');

  return (
    <>
      <PageHeader
        title={`${event.emoji} ${event.name}`}
        description={[
          isCampaign ? 'Fundraising campaign' : null,
          formatDate(event.starts_on),
          event.venue,
          countdown(event.starts_on),
        ]
          .filter(Boolean)
          .join(' · ')}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <EventStatusBadge status={event.status} />
            {canContribute ? (
              <ButtonLink href={`${here}/contribute`} size="sm">
                Contribute
              </ButtonLink>
            ) : null}
            {isStaff && event.status !== 'proposed' ? (
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

        {event.status === 'proposed' ? (
          <div className="border-warning/40 bg-warning/10 mb-5 flex items-start gap-3 rounded-xl border p-4 text-sm">
            <Clock className="text-warning mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink">
              This campaign is waiting for the committee. Residents will see it and can contribute
              once it is approved.
            </p>
          </div>
        ) : null}

        <nav
          aria-label="Event sections"
          className="border-border-base bg-surface-raised mb-5 flex gap-1 overflow-x-auto rounded-lg border p-1 text-sm"
        >
          {tabs.map((t) => (
            <Link
              key={t.id}
              href={t.id === 'about' ? here : `${here}?tab=${t.id}`}
              aria-current={active === t.id ? 'page' : undefined}
              scroll={false}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-center whitespace-nowrap',
                active === t.id
                  ? 'bg-surface-sunken text-ink font-medium'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
              {t.id === 'vote' && voting.length ? (
                <span className="bg-accent/15 text-accent ml-1.5 rounded-full px-1.5 text-xs">
                  {voting.length}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        {/* ---------------------------------------------------------- about */}
        {active === 'about' ? (
          <div className="space-y-5">
            <Card>
              <CardBody className="space-y-4">
                {event.description ? (
                  <p className="text-ink max-w-2xl text-sm leading-relaxed whitespace-pre-line">
                    {event.description}
                  </p>
                ) : null}
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div className="flex items-start gap-2.5">
                    <CalendarDays className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                    <div>
                      <dt className="sr-only">Date</dt>
                      <dd className="text-ink">
                        {formatDate(event.starts_on)}
                        {event.ends_on && event.ends_on !== event.starts_on
                          ? ` to ${formatDate(event.ends_on)}`
                          : ''}
                      </dd>
                      {countdown(event.starts_on) ? (
                        <dd className="text-ink-subtle text-xs">{countdown(event.starts_on)}</dd>
                      ) : null}
                    </div>
                  </div>
                  {event.venue ? (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">Venue</dt>
                        <dd className="text-ink">{event.venue}</dd>
                      </div>
                    </div>
                  ) : null}
                  {eventType || isCampaign ? (
                    <div className="flex items-start gap-2.5">
                      <Tag className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">Type</dt>
                        <dd className="text-ink">
                          {isCampaign
                            ? 'Fundraising campaign'
                            : `${eventType?.emoji ? `${eventType.emoji} ` : ''}${eventType?.label}`}
                        </dd>
                      </div>
                    </div>
                  ) : null}
                  {event.organizer ? (
                    <div className="flex items-start gap-2.5">
                      <Users className="text-ink-subtle mt-0.5 size-4" aria-hidden="true" />
                      <div>
                        <dt className="sr-only">Organised by</dt>
                        <dd className="text-ink">Organised by {event.organizer}</dd>
                      </div>
                    </div>
                  ) : null}
                </dl>
              </CardBody>
            </Card>

            <Link
              href={`${here}?tab=money`}
              className="border-border-base bg-surface-raised hover:bg-surface-sunken block rounded-xl border p-5 transition-colors"
            >
              <div className="text-ink-muted flex justify-between text-sm font-medium">
                <span>
                  {formatMoney(stats.fundRaised, community.currency)} of{' '}
                  {formatMoney(stats.fundTarget, community.currency)} raised
                </span>
                <span>{funded}%</span>
              </div>
              <div className="mt-2">
                <FundBar percent={funded} />
              </div>
              <p className="text-accent mt-2 text-xs">See where the money goes</p>
            </Link>
          </div>
        ) : null}

        {/* ---------------------------------------------------------- money */}
        {active === 'money' ? (
          <div className="space-y-5">
            <Card>
              <CardHeader
                title={isCampaign ? 'Campaign fund' : 'Fund'}
                action={<span className="text-success text-sm font-semibold">{funded}%</span>}
              />
              <CardBody>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-ink text-2xl font-semibold tracking-tight">
                      {formatMoney(stats.fundRaised, community.currency)}
                    </p>
                    <p className="text-ink-muted text-sm">
                      of {formatMoney(stats.fundTarget, community.currency)} target ·{' '}
                      {stats.contributors}{' '}
                      {stats.contributors === 1 ? 'household' : COPY.households.toLowerCase()} gave
                    </p>
                  </div>
                  {canContribute ? (
                    <ButtonLink href={`${here}/contribute`} size="sm">
                      Contribute
                    </ButtonLink>
                  ) : mine.contributed > 0 ? (
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
                    label="Balance"
                    value={formatMoney(stats.available, community.currency)}
                    tone={stats.available < 0 ? 'danger' : 'success'}
                  />
                </div>
              </CardBody>
            </Card>

            {myPayments.data?.length ? (
              <Card>
                <CardHeader title="Your payments" />
                <ul className="divide-border-base divide-y">
                  {myPayments.data.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex items-start justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium">
                          {formatMoney(payment.amount, community.currency)}
                        </p>
                        <p className="text-ink-subtle mt-0.5 text-xs">
                          {payment.status === 'succeeded' ? (
                            <span className="font-mono">
                              {receiptRef(event.slug, payment.receipt_no)} ·{' '}
                            </span>
                          ) : payment.reference ? (
                            <span className="font-mono">{payment.reference} · </span>
                          ) : null}
                          {formatDate(payment.paid_at.slice(0, 10))} ·{' '}
                          <span className="uppercase">{payment.method}</span>
                        </p>
                        {payment.status === 'failed' && payment.review_note ? (
                          <p className="text-danger mt-1 text-xs">{payment.review_note}</p>
                        ) : null}
                      </div>
                      <PaymentStatusBadge status={payment.status} />
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {!isCampaign ? (
              <Card>
                <CardHeader
                  title="Budget and spending"
                  description={
                    plannedTotal > 0
                      ? `${Math.round((stats.spent / plannedTotal) * 100)}% of the ${formatMoney(plannedTotal, community.currency)} budget used.`
                      : undefined
                  }
                />
                {categories.length ? (
                  <CardBody className="space-y-4">
                    <div className="text-ink-subtle flex gap-4 text-xs">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="bg-border-strong inline-block size-2.5 rounded-sm" />{' '}
                        Planned
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="bg-accent inline-block size-2.5 rounded-sm" /> Spent
                      </span>
                    </div>
                    {categories.map((row) => {
                      const over = row.planned > 0 && row.spent > row.planned;
                      return (
                        <div key={row.label}>
                          <div className="flex justify-between gap-3 text-sm">
                            <span className="text-ink font-medium">{row.label}</span>
                            <span className={over ? 'text-danger' : 'text-ink-muted'}>
                              {formatMoney(row.spent, community.currency)} of{' '}
                              {row.planned > 0
                                ? formatMoney(row.planned, community.currency)
                                : 'no budget'}
                            </span>
                          </div>
                          <div className="mt-1.5 space-y-1">
                            <div className="bg-surface-sunken h-2 overflow-hidden rounded-full">
                              <div
                                className="bg-border-strong h-full rounded-full"
                                style={{ width: `${(row.planned / largest) * 100}%` }}
                              />
                            </div>
                            <div className="bg-surface-sunken h-2 overflow-hidden rounded-full">
                              <div
                                className={cn(
                                  'h-full rounded-full',
                                  over ? 'bg-danger' : 'bg-accent',
                                )}
                                style={{ width: `${(row.spent / largest) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardBody>
                ) : (
                  <EmptyState
                    icon={<Wallet className="size-6" />}
                    title="No budget yet"
                    description="Staff add the planned spend for each category."
                  />
                )}
              </Card>
            ) : null}

            <Card>
              <CardHeader title={`Where the money went (${approved.length})`} />
              {approved.length ? (
                <>
                  <ul className="divide-border-base divide-y">
                    {approved.map((expense) => (
                      <li
                        key={expense.id}
                        className="flex items-start justify-between gap-3 px-5 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-medium">{expense.name}</p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {[
                              expense.category,
                              expense.vendor ?? 'Vendor not recorded',
                              formatDate(expense.spent_on),
                              expense.approver?.profiles?.full_name
                                ? `approved by ${expense.approver.profiles.full_name}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          <BillLink url={expense.bill_url} />
                        </div>
                        <span className="text-ink shrink-0 text-sm font-semibold">
                          {formatMoney(expense.amount, community.currency)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-border-base bg-surface-sunken flex justify-between border-t px-5 py-3 text-sm font-semibold">
                    <span className="text-ink">Total spent</span>
                    <span className="text-ink">{formatMoney(stats.spent, community.currency)}</span>
                  </div>
                </>
              ) : (
                <EmptyState
                  icon={<Receipt className="size-6" />}
                  title="Nothing spent yet"
                  description="Bills approved by the committee appear here, with the bill, for everyone to see."
                />
              )}
            </Card>

            {isStaff && awaiting.length ? (
              <Card>
                <CardHeader title="Waiting for the committee" />
                <ul className="divide-border-base divide-y">
                  {awaiting.map((expense) => (
                    <li
                      key={expense.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-medium">{expense.name}</p>
                        <p className="text-ink-subtle text-xs">
                          {expense.vendor ?? '—'}
                          {expense.review_note ? ` · ${expense.review_note}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-ink-muted text-sm">
                          {formatMoney(expense.amount, community.currency)}
                        </span>
                        <ExpenseStatusBadge status={expense.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <div className="border-border-base bg-surface-sunken text-ink-muted rounded-lg border px-4 py-3 text-sm">
              🔒 <span className="text-ink font-medium">If money is left over:</span>{' '}
              {event.fund_rule_note ?? FUND_RULE_LABEL[event.fund_rule]}
              <p className="text-ink-subtle mt-1 text-xs">
                Fixed when the event was created, before any money was collected.
              </p>
            </div>
          </div>
        ) : null}

        {/* ----------------------------------------------------- activities */}
        {active === 'activities' ? (
          activities.length ? (
            <div className="space-y-3">
              {activities.map((activity) => {
                const mineHere = myRegistrations.filter((r) => r.activity_id === activity.id);
                const selfRegistered = mineHere.some((r) => !r.participant_name);
                const count = registrations.filter((r) => r.activity_id === activity.id).length;
                const full = activity.capacity !== null && count >= activity.capacity;
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
                            {count} registered
                            {activity.capacity ? ` of ${activity.capacity} places` : ''}
                          </p>
                        </div>
                        {!activity.is_open ? (
                          <Badge tone="neutral">Closed</Badge>
                        ) : full ? (
                          <Badge tone="neutral">Full</Badge>
                        ) : null}
                      </div>

                      {mineHere.length ? (
                        <ul className="mt-3 space-y-1.5">
                          {mineHere.map((registration) => (
                            <li
                              key={registration.id}
                              className="flex items-center justify-between gap-3 text-sm"
                            >
                              <span className="text-success inline-flex items-center gap-1.5">
                                <Check className="size-4" aria-hidden="true" />
                                {registration.participant_name ?? 'You'}
                              </span>
                              {open ? (
                                <form action={cancelRegistration}>
                                  <input type="hidden" name="slug" value={slug} />
                                  <input type="hidden" name="event" value={event.slug} />
                                  <input
                                    type="hidden"
                                    name="registration_id"
                                    value={registration.id}
                                  />
                                  <button
                                    type="submit"
                                    className="text-ink-muted hover:text-ink text-xs underline underline-offset-4"
                                  >
                                    Withdraw
                                  </button>
                                </form>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {open && activity.is_open && !full && can(role, 'activities:register') ? (
                        <div className="border-border-base mt-3 border-t pt-3">
                          <RegisterForm
                            slug={slug}
                            eventSlug={event.slug}
                            activityId={activity.id}
                            activityName={activity.name}
                            selfRegistered={selfRegistered}
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
                description="Staff add activities you and your family can register for."
              />
            </Card>
          )
        ) : null}

        {/* ----------------------------------------------------------- vote */}
        {active === 'vote' ? (
          <div className="space-y-3">
            {voting.length ? (
              voting.map((suggestion) => {
                const total = suggestion.votesFor + suggestion.votesAgainst;
                const forPct = total ? Math.round((suggestion.votesFor / total) * 100) : 0;
                return (
                  <Card key={suggestion.id}>
                    <CardBody>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-ink text-sm font-semibold">{suggestion.name}</p>
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            {suggestion.kind === 'idea' ? 'Idea' : 'Activity'} suggested by{' '}
                            {suggestion.memberships?.profiles?.full_name ?? 'a resident'}
                          </p>
                          {suggestion.description ? (
                            <p className="text-ink-muted mt-1.5 text-sm">
                              {suggestion.description}
                            </p>
                          ) : null}
                        </div>
                        <Badge tone="success">Voting</Badge>
                      </div>
                      <div className="mt-3">
                        <div className="text-ink-muted mb-1 flex justify-between text-xs font-medium">
                          <span>
                            {suggestion.votesFor} for · {suggestion.votesAgainst} against
                          </span>
                          <span>{total ? `${forPct}% in favour` : 'No votes yet'}</span>
                        </div>
                        <FundBar percent={forPct} />
                      </div>
                      {can(role, 'vote') && event.status !== 'completed' ? (
                        <form
                          action={voteOnSuggestion}
                          className="mt-3 flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="event" value={event.slug} />
                          <input type="hidden" name="suggestion_id" value={suggestion.id} />
                          <Button
                            type="submit"
                            name="support"
                            value="1"
                            size="sm"
                            variant={suggestion.myVote === true ? 'primary' : 'secondary'}
                            aria-pressed={suggestion.myVote === true}
                          >
                            <ThumbsUp className="size-4" aria-hidden="true" />
                            For
                          </Button>
                          <Button
                            type="submit"
                            name="support"
                            value="0"
                            size="sm"
                            variant={suggestion.myVote === false ? 'primary' : 'secondary'}
                            aria-pressed={suggestion.myVote === false}
                          >
                            <ThumbsDown className="size-4" aria-hidden="true" />
                            Against
                          </Button>
                          {suggestion.myVote !== null ? (
                            <Button
                              type="submit"
                              name="withdraw"
                              value="1"
                              size="sm"
                              variant="ghost"
                            >
                              Withdraw vote
                            </Button>
                          ) : null}
                        </form>
                      ) : null}
                    </CardBody>
                  </Card>
                );
              })
            ) : (
              <Card>
                <EmptyState
                  icon={<Lightbulb className="size-6" />}
                  title="Nothing to vote on yet"
                  description="Suggestions the committee approves are put to residents here."
                />
              </Card>
            )}

            {mySuggestions.length ? (
              <Card>
                <CardHeader title="Your suggestions" />
                <ul className="divide-border-base divide-y">
                  {mySuggestions.map((suggestion) => (
                    <li
                      key={suggestion.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink text-sm">{suggestion.name}</p>
                        {suggestion.review_note ? (
                          <p className="text-ink-subtle text-xs">“{suggestion.review_note}”</p>
                        ) : null}
                      </div>
                      <Badge tone={suggestion.status === 'declined' ? 'neutral' : 'warning'}>
                        {suggestion.status === 'declined' ? 'Declined' : 'With the committee'}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {can(role, 'suggest') && event.status === 'published' ? (
              <Card>
                <CardHeader
                  title="Suggest something"
                  description="The committee reviews every suggestion, then puts it to residents for a vote."
                />
                <CardBody>
                  <SuggestionForm slug={slug} eventSlug={event.slug} eventId={event.id} />
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}
      </PageBody>
    </>
  );
}
