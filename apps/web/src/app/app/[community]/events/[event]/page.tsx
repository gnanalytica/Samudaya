import Link from 'next/link';
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Clock,
  MapPin,
  Receipt,
  Settings2,
  Sparkles,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';
import {
  COPY,
  FUND_RULE_LABEL,
  can,
  correctionNote,
  countdown,
  formatDate,
  festivalFor,
  formatMoney,
  fundAsk,
  fundBarSegments,
  receiptRef,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import {
  budgetVsSpent,
  getActivities,
  getBudgetLines,
  getCarriedInto,
  getEventStats,
  getExpenses,
  getMyParticipation,
  getRegistrations,
  getSuggestions,
  requireEvent,
} from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { PageBody } from '@/components/page-header';
import { FestivalHeader, festivalVars } from '@/components/festival';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  EventStatusBadge,
  ExpenseStatusBadge,
  FundBar,
  PaymentStatusBadge,
  StatTile,
  StatTiles,
} from '@/components/badges';
import { getSupabase } from '@/lib/supabase/server';
import { BillLink } from '@/components/bill-link';
import { CarriedIn } from '@/components/carried-in';
import { AuditTrail } from '@/components/audit-trail';
import { SuggestionBoard } from '@/components/suggestion-board';
import { CommentThread } from '@/components/comment-thread';
import { WhatsappGroupLink } from '@/components/whatsapp-group-link';
import { EventTabs, eventTabsFor } from '@/components/event-tabs';
import { cn } from '@/lib/utils';
import { cancelRegistration } from '../actions';
import { RegisterForm, SuggestionForm } from './participation-forms';

/**
 * An event in four tabs: About, Money (the fund, budget against spending and
 * every approved bill), Activities to register for, and Vote.
 */
export default async function EventDetailPage(props: PageProps<'/app/[community]/events/[event]'>) {
  const { community: slug, event: eventSlug } = await props.params;
  const { tab } = await props.searchParams;
  // Committee in resident view sees exactly what residents see.
  const { community, viewRole: role, membership } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);

  const supabase = await getSupabase();
  const [
    stats,
    budget,
    expenses,
    activities,
    registrations,
    suggestions,
    mine,
    myPayments,
    carriedIn,
  ] = await Promise.all([
    getEventStats(event.id),
    getBudgetLines(event.id),
    getExpenses(event.id),
    getActivities(event.id),
    getRegistrations(event.id),
    getSuggestions(event.id, membership.id),
    getMyParticipation(event.id, membership.id),
    supabase
      .from('contributions')
      .select(
        'id, amount, reported_amount, status, method, reference, receipt_no, review_note, paid_at',
      )
      .eq('event_id', event.id)
      .eq('membership_id', membership.id)
      .order('paid_at', { ascending: false }),
    getCarriedInto(event.id),
  ]);

  const base = `/app/${community.slug}`;
  const here = `${base}/events/${event.slug}`;
  const bar = fundBarSegments(
    stats.fundRaised,
    stats.fundPending,
    stats.fundTarget,
    stats.fundCarried,
  );
  const funded = bar.confirmed;
  // What residents are asked for, which is what the fund cards lead with: the
  // target less anything the committee carried across (see fundAsk).
  const ask = fundAsk(stats.fundTarget, stats.fundCarried);
  const open = event.status === 'published';
  const isCampaign = event.kind === 'campaign';
  const isStaff = can(role, 'events:manage');
  const canApprove = can(role, 'suggestions:approve');
  // The Vote tab's badge counts what is waiting on *this* person: a vote they
  // have not cast, or — for the committee — a suggestion nobody has opened yet.
  const needsMe = suggestions.filter((s) =>
    s.status === 'accepted' ? s.myVote === null : canApprove && s.status === 'new',
  ).length;
  const approved = expenses.filter((expense) => expense.status === 'approved');
  const awaiting = expenses.filter((expense) => expense.status !== 'approved');
  const categories = budgetVsSpent(budget, expenses);
  const plannedTotal = categories.reduce((sum, row) => sum + row.planned, 0);
  const largest = Math.max(1, ...categories.map((row) => Math.max(row.planned, row.spent)));
  const myRegistrations = registrations.filter((r) => r.membership_id === membership.id);

  // One list, shared with the console, so the two bars cannot drift apart.
  const tabs = eventTabsFor({ role, kind: event.kind, status: event.status }).filter(
    (t) => !t.admin,
  );
  const active = tabs.find((t) => t.id === tab)?.id ?? 'about';

  const eventType = event.event_type_id
    ? (await getCatalogue(community.id)).event_type.find((item) => item.id === event.event_type_id)
    : null;
  const canContribute = open && can(role, 'contribute');
  // Deepavali is marigold, Dasara vermilion, a clean-up drive the society's own
  // green. The whole page takes the colour, not just its header.
  const festival = festivalFor(eventType?.label, event.name);

  return (
    <div style={festivalVars(festival)}>
      <FestivalHeader
        festival={festival}
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
              Waiting for the committee. Once approved, residents can see it and contribute.
            </p>
          </div>
        ) : null}

        <EventTabs
          base={base}
          eventSlug={event.slug}
          active={active}
          role={role}
          kind={event.kind}
          status={event.status}
          counts={{ vote: needsMe }}
        />

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
                        {/* The label lives in the dt like every other row here. It
                            used to be repeated in the value too, which a screen
                            reader read back as "Organised by Organised by …". */}
                        <dt className="sr-only">Organised by</dt>
                        <dd className="text-ink">{event.organizer}</dd>
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
                  {formatMoney(ask, community.currency)} raised
                </span>
                <span>{funded}%</span>
              </div>
              <div className="mt-2">
                <FundBar percent={funded} pendingPercent={bar.pending} />
              </div>
              <CarriedIn
                target={stats.fundTarget}
                carried={stats.fundCarried}
                movements={carriedIn}
                currency={community.currency}
              />
              <p className="text-accent mt-2 text-xs">See where the money goes</p>
            </Link>

            {event.whatsapp_group_url ? (
              <Card>
                <CardBody className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">This event has a WhatsApp group</p>
                  </div>
                  <WhatsappGroupLink url={event.whatsapp_group_url} />
                </CardBody>
              </Card>
            ) : null}

            {/* The argument that produced the decision, kept next to it. A tab
                of its own would have made five; it belongs under About. */}
            <Card>
              <CardHeader title="Discussion" description="Everyone in the society can read this." />
              <CardBody>
                <CommentThread
                  slug={slug}
                  subject={{ eventId: event.id }}
                  eventSlug={event.slug}
                  myMembershipId={membership.id}
                  canModerate={isStaff}
                />
              </CardBody>
            </Card>
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
                      raised of {formatMoney(ask, community.currency)} · {stats.contributors}{' '}
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
                  <FundBar percent={funded} pendingPercent={bar.pending} />
                </div>
                {stats.fundPending > 0 ? (
                  <p className="text-ink-subtle mt-2 text-xs">
                    {formatMoney(stats.fundPending, community.currency)} more reported, waiting to
                    be confirmed.
                  </p>
                ) : null}
                {/* Money the society already had, moved here by the committee,
                    and who moved it. */}
                <CarriedIn
                  target={stats.fundTarget}
                  carried={stats.fundCarried}
                  movements={carriedIn}
                  currency={community.currency}
                />
                <StatTiles className="mt-4 gap-2">
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
                </StatTiles>
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
                        {correctionNote(
                          payment.amount,
                          payment.reported_amount,
                          community.currency,
                        ) ? (
                          <p className="text-warning mt-1 text-xs">
                            {correctionNote(
                              payment.amount,
                              payment.reported_amount,
                              community.currency,
                            )}
                            {payment.review_note ? ` · ${payment.review_note}` : ''}
                          </p>
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
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                          {/* Who signed this off and when, on the bill itself,
                              where a resident reading the ledger can see it. */}
                          <p className="text-ink-subtle mt-0.5 text-xs">
                            <AuditTrail
                              confirmedBy={expense.approver?.profiles?.full_name}
                              confirmedAt={expense.approved_at}
                              editedBy={expense.editor?.profiles?.full_name}
                              editedAt={expense.updated_at}
                              confirmedLabel="Approved"
                            />
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
                  description="Bills the committee approves appear here, for everyone to see."
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
              <p className="text-ink-subtle mt-1 text-xs">Fixed before any money was collected.</p>
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
            <SuggestionBoard
              slug={slug}
              eventSlug={event.slug}
              rows={suggestions}
              myMembershipId={membership.id}
              canVote={can(role, 'vote') && event.status !== 'completed'}
              canApprove={canApprove}
              emptyDescription="Suggestions the committee approves go to a vote here."
            />
            {can(role, 'suggest') && event.status === 'published' ? (
              <Card>
                <CardHeader
                  title="Suggest something"
                  description="The committee reviews it first."
                />
                <CardBody>
                  <SuggestionForm slug={slug} eventSlug={event.slug} eventId={event.id} />
                </CardBody>
              </Card>
            ) : null}
          </div>
        ) : null}
      </PageBody>
    </div>
  );
}
