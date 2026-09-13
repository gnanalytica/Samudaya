import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  Check,
  Clock,
  Lightbulb,
  Receipt,
  Settings2,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Wallet,
} from 'lucide-react';
import { can, countdown, formatDate, formatMoney, fundedPercent } from '@samudaya/core';
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
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { EventStatusBadge, FundBar, PaymentStatusBadge, StatTile } from '@/components/badges';
import { getSupabase } from '@/lib/supabase/server';
import { BillLink } from '@/components/bill-link';
import { cancelRegistration, voteOnSuggestion } from '../actions';
import { RegisterForm, SuggestionForm } from './participation-forms';

export default async function EventDetailPage(props: PageProps<'/app/[community]/events/[event]'>) {
  const { community: slug, event: eventSlug } = await props.params;
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
        .select('id, amount, status, review_note')
        .eq('event_id', event.id)
        .eq('membership_id', membership.id)
        .order('paid_at', { ascending: false }),
    ]);

  const base = `/app/${community.slug}`;
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const open = event.status === 'published';
  const isCampaign = event.kind === 'campaign';
  const approved = expenses.filter((expense) => expense.status === 'approved');
  const categories = budgetVsSpent(budget, expenses);
  const myRegistrations = registrations.filter((r) => r.membership_id === membership.id);
  const voting = suggestions.filter((s) => s.status === 'accepted');
  const mySuggestions = suggestions.filter(
    (s) => s.suggested_by === membership.id && s.status !== 'accepted',
  );

  return (
    <>
      <PageHeader
        title={`${event.emoji} ${event.name}`}
        description={[
          isCampaign ? 'Fundraising campaign' : null,
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
            {can(role, 'events:manage') && event.status !== 'proposed' ? (
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

        {event.description ? (
          <p className="text-ink-muted mb-5 max-w-2xl text-sm leading-relaxed whitespace-pre-line">
            {event.description}
          </p>
        ) : null}

        {/* ----------------------------------------------------------- fund */}
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
              <StatTile label="Raised" value={formatMoney(stats.fundRaised, community.currency)} />
              <StatTile label="Spent" value={formatMoney(stats.spent, community.currency)} />
              <StatTile
                label="Balance"
                value={formatMoney(stats.available, community.currency)}
                tone={stats.available < 0 ? 'danger' : 'success'}
              />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {open && can(role, 'contribute') ? (
                <ButtonLink href={`${base}/events/${event.slug}/contribute`} size="sm">
                  Contribute
                </ButtonLink>
              ) : null}
              {event.status !== 'proposed' ? (
                <ButtonLink
                  href={`${base}/events/${event.slug}/accounts`}
                  size="sm"
                  variant="secondary"
                >
                  <BarChart3 className="size-4" aria-hidden="true" />
                  Money and analytics
                </ButtonLink>
              ) : null}
            </div>
            {myPayments.data?.length ? (
              <ul className="border-border-base mt-4 space-y-2 border-t pt-3">
                {myPayments.data.map((payment) => (
                  <li key={payment.id} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-ink-muted">You paid</span>
                    <span className="text-ink font-medium">
                      {formatMoney(payment.amount, community.currency)}
                    </span>
                    <PaymentStatusBadge status={payment.status} />
                    {payment.status === 'failed' && payment.review_note ? (
                      <span className="text-danger text-xs">{payment.review_note}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>

        {/* ------------------------------------------------- budget vs spent */}
        {!isCampaign ? (
          <section id="budget" className="mt-8 scroll-mt-20">
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">Budget and spending</h2>
            <Card>
              {categories.length ? (
                <ul className="divide-border-base divide-y">
                  {categories.map((row) => {
                    const pct = row.planned > 0 ? Math.round((row.spent / row.planned) * 100) : 100;
                    const over = row.planned > 0 && row.spent > row.planned;
                    return (
                      <li key={row.label} className="px-5 py-3">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-ink font-medium">{row.label}</span>
                          <span className={over ? 'text-danger' : 'text-ink-muted'}>
                            {formatMoney(row.spent, community.currency)} of{' '}
                            {row.planned > 0
                              ? formatMoney(row.planned, community.currency)
                              : 'no budget'}
                          </span>
                        </div>
                        <div className="bg-surface-sunken mt-2 h-2 overflow-hidden rounded-full">
                          <div
                            className={
                              over
                                ? 'bg-danger h-full rounded-full'
                                : 'bg-accent h-full rounded-full'
                            }
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<Wallet className="size-6" />}
                  title="No budget yet"
                  description="Staff add the planned spend for each category."
                />
              )}
            </Card>
          </section>
        ) : null}

        {/* -------------------------------------------------------- spending */}
        <section id="spending" className="mt-8 scroll-mt-20">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-ink-soft text-sm font-semibold">Where the money went</h2>
            {event.status !== 'proposed' ? (
              <Link
                href={`${base}/events/${event.slug}/accounts`}
                className="text-accent text-sm hover:underline"
              >
                Full accounts
              </Link>
            ) : null}
          </div>
          <Card>
            {approved.length ? (
              <ul className="divide-border-base divide-y">
                {approved.map((expense) => (
                  <li key={expense.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{expense.name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {[
                          expense.category,
                          expense.vendor ?? 'Vendor not recorded',
                          formatDate(expense.spent_on),
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
            ) : (
              <EmptyState
                icon={<Receipt className="size-6" />}
                title="Nothing spent yet"
                description="Bills approved by the committee appear here, for everyone to see."
              />
            )}
          </Card>
        </section>

        {/* ------------------------------------------------------ activities */}
        {!isCampaign ? (
          <section id="activities" className="mt-8 scroll-mt-20">
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">Activities</h2>
            {activities.length ? (
              <div className="space-y-3">
                {activities.map((activity) => {
                  const here = myRegistrations.filter((r) => r.activity_id === activity.id);
                  const selfRegistered = here.some((r) => !r.participant_name);
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

                        {here.length ? (
                          <ul className="mt-3 space-y-1.5">
                            {here.map((registration) => (
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
            )}
          </section>
        ) : null}

        {/* ----------------------------------------------------- suggestions */}
        {event.status !== 'proposed' ? (
          <section id="suggestions" className="mt-8 scroll-mt-20">
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">Suggestions and voting</h2>
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
                              {suggestion.memberships?.profiles?.full_name ?? 'a resident'} ·
                              approved for voting
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
          </section>
        ) : null}

        {event.fund_rule_note ? (
          <p className="border-border-base bg-surface-sunken text-ink-muted mt-8 rounded-lg border px-4 py-3 text-sm">
            🔒 {event.fund_rule_note}
          </p>
        ) : null}
      </PageBody>
    </>
  );
}
