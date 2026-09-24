import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Lightbulb,
  Megaphone,
  PiggyBank,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import {
  COPY,
  can,
  countdown,
  festivalFor,
  formatDate,
  formatMoney,
  fundAsk,
  fundBarSegments,
  todayIn,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getTodoItems } from '@/lib/todo';
import { getSocietyBalance, getIdeas, listEvents, getStatsFor } from '@/lib/events';
import { getCatalogue } from '@/lib/catalogue';
import { bottomNavItems } from '@/components/nav-items';
import { FestivalHeader, Rangoli, festivalVars } from '@/components/festival';
import { WhatsappGroupLink } from '@/components/whatsapp-group-link';
import { PageBody } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile, StatTiles } from '@/components/badges';
import { WelcomeCard } from '@/components/welcome-card';

export default async function DashboardPage(props: PageProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  const { joined } = await props.searchParams;
  // Committee in resident view sees exactly what residents see.
  const { community, viewRole: role, profile, membership } = await requireCommunity(slug);
  const base = `/app/${community.slug}`;

  // The phone's bottom bar has four slots and the society has more than four
  // places. Rather than hard-code what it left out — which is how two lists
  // drift until one of them strands a page — subtract the bar from the list.
  // A resident's bar carries Money, so they see People here; staff trade Money
  // for Manage, so they see both.
  const onTheBar = new Set(bottomNavItems(community.slug, role).map((item) => item.href));
  const alsoHere = [
    {
      href: `${base}/people`,
      label: 'People',
      detail: 'Everyone in the society, by flat',
      icon: Users,
    },
    {
      href: `${base}/money`,
      label: 'Money',
      detail: 'Every rupee in and out, for every event',
      icon: Wallet,
    },
  ].filter((item) => !onTheBar.has(item.href));

  const events = await listEvents(community.id);
  const published = events.filter((event) => event.status === 'published');
  const today = todayIn(community.timezone);
  const next =
    published
      .filter((event) => event.kind === 'event' && event.starts_on >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ??
    published.find((event) => event.kind === 'event') ??
    published[0];
  const campaigns = published.filter((event) => event.kind === 'campaign' && event.id !== next?.id);

  const stats = await getStatsFor(
    [next?.id, ...campaigns.map((c) => c.id)].filter(Boolean) as string[],
  );
  const typeLabel = new Map(
    (await getCatalogue(community.id)).event_type.map((item) => [item.id, item.label]),
  );
  const s = next ? stats.get(next.id) : undefined;
  const bar = fundBarSegments(
    s?.fundRaised ?? 0,
    s?.fundPending ?? 0,
    s?.fundTarget ?? 0,
    s?.fundCarried ?? 0,
  );
  const funded = bar.confirmed;
  const firstName = profile?.full_name?.split(' ')[0];

  const staff = can(role, 'events:manage');
  const todo = await getTodoItems(community.id, role);
  const nextFestival = festivalFor(
    next?.event_type_id ? typeLabel.get(next.event_type_id) : null,
    next?.name,
  );
  const balance = await getSocietyBalance(community.id);
  // Every idea in the society, an event's as much as its own: a vote you have
  // not cast is a vote you have not cast, and this used to count only half of
  // them because the other half lived on their event's page.
  const ideas = await getIdeas(community.id, membership.id);
  const societyIdeas = ideas.filter((row) => row.status === 'accepted').length;
  // Voting is the best thing in the app and it was four taps down. This is what
  // is waiting on you — a vote you have not cast — rather than what exists.
  const needsMySay = ideas.filter((row) => row.status === 'accepted' && row.myVote === null).length;

  return (
    <>
      {/* The whole page takes the colour of whatever the society is heading
          towards next, so opening the app in October looks like October. */}
      <FestivalHeader
        festival={nextFestival}
        title={firstName ? `Hello, ${firstName}` : community.name}
        description={next ? `${community.name} · ${nextFestival.label} next` : community.name}
      />

      <PageBody>
        {!membership.welcomed_at ? (
          <WelcomeCard
            slug={community.slug}
            role={role}
            societyName={community.name}
            joinCode={community.join_code}
          />
        ) : null}

        {joined && membership.welcomed_at ? (
          <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 mb-5 flex items-start gap-3 rounded-xl border p-4">
            <Sparkles className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink text-sm font-medium">You’ve joined {community.name}.</p>
          </div>
        ) : null}

        {/* Money the society is holding that is not behind any event: what a
            closed event had left, once the committee decided to keep it. On
            everybody's home screen, resident and committee alike, because it
            is the one figure a society is most often asked about and least
            often able to answer. Tapping it shows where every rupee came
            from. */}
        {balance.balance > 0 ? (
          <Link
            href={`${base}/money#society-balance`}
            className="border-border-base bg-surface-raised hover:bg-surface-sunken mb-5 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="min-w-0">
              <span className="text-ink flex items-center gap-2 text-sm font-medium">
                <PiggyBank className="text-accent size-5 shrink-0" aria-hidden="true" />
                Kept for the society: {formatMoney(balance.balance, community.currency)}
              </span>
              <span className="text-ink-subtle mt-0.5 block text-xs">
                Left over from {balance.movements} closed{' '}
                {balance.movements === 1 ? 'event' : 'events'}, not yet behind a new one
              </span>
            </span>
            <ArrowRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : null}

        {todo.length ? (
          <Link
            href={`${base}/todo`}
            className="border-warning/40 bg-surface-raised hover:bg-surface-sunken mb-5 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="text-ink flex items-center gap-2 text-sm font-medium">
              <ClipboardCheck className="text-warning size-5" aria-hidden="true" />
              {COPY.todo}: {todo.length} {todo.length === 1 ? 'thing needs' : 'things need'} you
            </span>
            <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
          </Link>
        ) : null}

        {needsMySay && can(role, 'vote') ? (
          <Link
            href={`${base}/suggest`}
            className="border-accent/40 bg-surface-raised hover:bg-surface-sunken mb-5 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="text-ink flex items-center gap-2 text-sm font-medium">
              <Lightbulb className="text-accent size-5" aria-hidden="true" />
              {needsMySay} {needsMySay === 1 ? 'idea is' : 'ideas are'} waiting for your vote
            </span>
            <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
          </Link>
        ) : null}

        {next ? (
          <>
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">Next up</h2>
            <div
              style={festivalVars(nextFestival)}
              className="border-border-base bg-surface-raised overflow-hidden rounded-xl border"
            >
              <div className="relative isolate overflow-hidden bg-gradient-to-br from-[var(--accent)] to-[var(--ribbon)] p-5 text-white">
                <Rangoli
                  petals={nextFestival.petals}
                  strokeWidth={2}
                  mono
                  className="pointer-events-none absolute -top-8 -right-10 size-44 text-white opacity-25"
                />
                <div className="relative text-3xl">{next.emoji}</div>
                <p className="relative mt-2 text-lg font-semibold">{next.name}</p>
                <p className="relative mt-0.5 text-sm text-white/80">
                  {formatDate(next.starts_on)}
                  {next.venue ? ` · ${next.venue}` : ''}
                  {countdown(next.starts_on) ? ` · ${countdown(next.starts_on)}` : ''}
                </p>
                <div className="relative mt-4 flex justify-between text-xs font-medium text-white/80">
                  <span>
                    {formatMoney(s?.fundRaised ?? 0, community.currency)} of{' '}
                    {formatMoney(
                      fundAsk(s?.fundTarget ?? 0, s?.fundCarried ?? 0),
                      community.currency,
                    )}{' '}
                    raised
                  </span>
                  <span>{funded}%</span>
                </div>
                <div
                  className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-black/20"
                  role="progressbar"
                  aria-valuenow={funded}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Fund progress"
                >
                  <div
                    className="h-full rounded-full bg-white/85"
                    style={{ width: `${funded}%` }}
                  />
                </div>
                {(s?.fundCarried ?? 0) > 0 ? (
                  <p className="relative mt-1.5 text-xs text-white/75">
                    After {formatMoney(s?.fundCarried ?? 0, community.currency)} carried across by
                    the committee
                  </p>
                ) : null}
                <div className="relative mt-4 flex flex-wrap gap-2">
                  <ButtonLink
                    href={`${base}/events/${next.slug}`}
                    size="sm"
                    variant="secondary"
                    className="border-white/25 bg-white/15 text-white hover:bg-white/25"
                  >
                    View event
                  </ButtonLink>
                  {can(role, 'contribute') ? (
                    <ButtonLink href={`${base}/events/${next.slug}/contribute`} size="sm">
                      Contribute
                    </ButtonLink>
                  ) : null}
                </div>
              </div>
              <StatTiles className="border-border-base border-t p-4">
                <StatTile label="Spent" value={formatMoney(s?.spent ?? 0, community.currency)} />
                <StatTile label={`${COPY.households} gave`} value={String(s?.contributors ?? 0)} />
                <StatTile label="Registered" value={String(s?.participants ?? 0)} />
              </StatTiles>
            </div>

            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Take part</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={`${base}/events/${next.slug}?tab=activities`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <CalendarDays className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Activities</p>
                <p className="text-ink-muted text-xs">Register yourself or your family.</p>
              </Link>
              <Link
                href={`${base}/events/${next.slug}?tab=vote`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <Lightbulb className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Suggest and vote</p>
                <p className="text-ink-muted text-xs">Ideas the committee approves go to a vote.</p>
              </Link>
              <Link
                href={`${base}/events/${next.slug}?tab=money`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <BarChart3 className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Where the money goes</p>
                <p className="text-ink-muted text-xs">Budget, spending and every bill.</p>
              </Link>
            </div>
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="Nothing planned yet"
              description={
                staff
                  ? 'Create the first event with its budget, then publish it.'
                  : 'When the society plans something, it will show up here.'
              }
              action={
                staff ? (
                  <ButtonLink href={`${base}/admin/events/new`} size="sm">
                    Create an event
                  </ButtonLink>
                ) : undefined
              }
            />
          </Card>
        )}

        {campaigns.length ? (
          <>
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Fundraising campaigns</h2>
            <div className="space-y-3">
              {campaigns.map((campaign) => {
                const cs = stats.get(campaign.id);
                const pct = fundBarSegments(
                  cs?.fundRaised ?? 0,
                  0,
                  cs?.fundTarget ?? 0,
                  cs?.fundCarried ?? 0,
                ).confirmed;
                return (
                  <Link
                    key={campaign.id}
                    href={`${base}/events/${campaign.slug}`}
                    className="border-border-base bg-surface-raised hover:bg-surface-sunken block rounded-xl border p-4"
                  >
                    <div className="flex justify-between gap-3 text-sm">
                      <span className="text-ink font-semibold">
                        {campaign.emoji} {campaign.name}
                      </span>
                      <span className="text-ink-muted">{pct}%</span>
                    </div>
                    <p className="text-ink-subtle mt-1 text-xs">
                      {formatMoney(cs?.fundRaised ?? 0, community.currency)} of{' '}
                      {formatMoney(
                        fundAsk(cs?.fundTarget ?? 0, cs?.fundCarried ?? 0),
                        community.currency,
                      )}
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}

        {community.whatsapp_group_url ? (
          <div className="mt-8">
            <WhatsappGroupLink
              url={community.whatsapp_group_url}
              label={`Join the ${community.name} WhatsApp group`}
            />
          </div>
        ) : null}

        {/* Phone only: on a desktop the sidebar already lists every one of
            these, and a card repeating the sidebar two inches to its right is
            noise. This exists because the bar is four slots wide. */}
        {alsoHere.length ? (
          <div className="md:hidden">
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">More in this society</h2>
            <div className="space-y-3">
              {alsoHere.map(({ href, label, detail, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="border-border-base bg-surface-raised hover:bg-surface-sunken flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <span className="flex items-center gap-3">
                    <Icon className="text-accent size-5 shrink-0" aria-hidden="true" />
                    <span>
                      <span className="text-ink block text-sm font-semibold">{label}</span>
                      <span className="text-ink-muted block text-xs">{detail}</span>
                    </span>
                  </span>
                  <ArrowRight className="text-ink-subtle size-4 shrink-0" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Raising money was the only thing a resident could start from here.
            Most of what a society actually argues about costs nothing. */}
        {can(role, 'suggest') || can(role, 'campaigns:propose') ? (
          <>
            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Start something</h2>
            <div className="space-y-3">
              {can(role, 'suggest') ? (
                <Link
                  href={`${base}/suggest`}
                  className="border-border-base bg-surface-raised hover:bg-surface-sunken flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <span className="flex items-center gap-3">
                    <Lightbulb className="text-accent size-5" aria-hidden="true" />
                    <span>
                      <span className="text-ink block text-sm font-semibold">
                        Suggest an idea or an activity
                      </span>
                      <span className="text-ink-muted block text-xs">
                        For an event or for the society. The committee puts it to a vote.
                        {societyIdeas ? ` ${societyIdeas} open for voting now.` : ''}
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
                </Link>
              ) : null}
              {can(role, 'campaigns:propose') ? (
                <Link
                  href={`${base}/events/propose`}
                  className="border-border-base bg-surface-raised hover:bg-surface-sunken flex items-center justify-between gap-3 rounded-xl border p-4"
                >
                  <span className="flex items-center gap-3">
                    <Megaphone className="text-accent size-5" aria-hidden="true" />
                    <span>
                      <span className="text-ink block text-sm font-semibold">
                        Start a fundraising campaign
                      </span>
                      <span className="text-ink-muted block text-xs">
                        Raise money for something the society needs. The committee approves it
                        first.
                      </span>
                    </span>
                  </span>
                  <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </PageBody>
    </>
  );
}
