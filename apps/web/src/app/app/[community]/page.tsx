import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ClipboardCheck,
  Lightbulb,
  Megaphone,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { can, countdown, formatDate, formatMoney, fundedPercent } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { listEvents, getStatsFor } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile } from '@/components/badges';

export default async function DashboardPage(props: PageProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  const { joined } = await props.searchParams;
  const { community, role, profile } = await requireCommunity(slug);
  const supabase = await getSupabase();
  const base = `/app/${community.slug}`;

  const events = await listEvents(community.id);
  const published = events.filter((event) => event.status === 'published');
  const today = new Date().toISOString().slice(0, 10);
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
  const s = next ? stats.get(next.id) : undefined;
  const funded = fundedPercent(s?.fundRaised ?? 0, s?.fundTarget ?? 0);
  const firstName = profile?.full_name?.split(' ')[0];

  const staff = can(role, 'events:manage');
  const [requests, forCommittee] = staff
    ? await Promise.all([
        supabase
          .from('join_requests')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending'),
        can(role, 'expenses:approve')
          ? Promise.all([
              supabase
                .from('expenses')
                .select('id', { count: 'exact', head: true })
                .eq('community_id', community.id)
                .eq('status', 'pending'),
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
            ]).then((rows) => rows.reduce((sum, row) => sum + (row.count ?? 0), 0))
          : Promise.resolve(0),
      ])
    : [null, 0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : community.name}
        description={community.name}
      />

      <PageBody>
        {joined ? (
          <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 mb-5 flex items-start gap-3 rounded-xl border p-4">
            <Sparkles className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <p className="text-ink text-sm font-medium">You’ve joined {community.name}.</p>
          </div>
        ) : null}

        {staff && ((requests?.count ?? 0) > 0 || forCommittee > 0) ? (
          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            {(requests?.count ?? 0) > 0 ? (
              <Link
                href={`${base}/admin/requests`}
                className="border-warning/40 bg-surface-raised hover:bg-surface-sunken flex items-center justify-between gap-3 rounded-xl border p-4"
              >
                <span className="text-ink flex items-center gap-2 text-sm font-medium">
                  <UserPlus className="text-warning size-5" aria-hidden="true" />
                  {requests?.count} waiting to join
                </span>
                <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
              </Link>
            ) : null}
            {forCommittee > 0 ? (
              <Link
                href={`${base}/admin/approvals`}
                className="border-warning/40 bg-surface-raised hover:bg-surface-sunken flex items-center justify-between gap-3 rounded-xl border p-4"
              >
                <span className="text-ink flex items-center gap-2 text-sm font-medium">
                  <ClipboardCheck className="text-warning size-5" aria-hidden="true" />
                  {forCommittee} waiting for the committee
                </span>
                <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        ) : null}

        {next ? (
          <>
            <h2 className="text-ink-soft mb-3 text-sm font-semibold">Next up</h2>
            <div className="border-border-base bg-surface-raised overflow-hidden rounded-xl border">
              <div className="from-brand-700 to-brand-900 bg-gradient-to-br p-5 text-white">
                <div className="text-3xl">{next.emoji}</div>
                <p className="mt-2 text-lg font-semibold">{next.name}</p>
                <p className="text-brand-100 mt-0.5 text-sm">
                  {formatDate(next.starts_on)}
                  {next.venue ? ` · ${next.venue}` : ''}
                  {countdown(next.starts_on) ? ` · ${countdown(next.starts_on)}` : ''}
                </p>
                <div className="text-brand-100 mt-4 flex justify-between text-xs font-medium">
                  <span>
                    {formatMoney(s?.fundRaised ?? 0, community.currency)} of{' '}
                    {formatMoney(s?.fundTarget ?? 0, community.currency)} raised
                  </span>
                  <span>{funded}%</span>
                </div>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/20"
                  role="progressbar"
                  aria-valuenow={funded}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Fund progress"
                >
                  <div
                    className="bg-brand-300 h-full rounded-full"
                    style={{ width: `${funded}%` }}
                  />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
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
              <div className="border-border-base grid grid-cols-3 gap-3 border-t p-4">
                <StatTile label="Spent" value={formatMoney(s?.spent ?? 0, community.currency)} />
                <StatTile label="Contributed" value={String(s?.contributors ?? 0)} />
                <StatTile label="Registered" value={String(s?.participants ?? 0)} />
              </div>
            </div>

            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Take part</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={`${base}/events/${next.slug}#activities`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <CalendarDays className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Activities</p>
                <p className="text-ink-muted text-xs">Register yourself or your family.</p>
              </Link>
              <Link
                href={`${base}/events/${next.slug}#suggestions`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <Lightbulb className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Suggest and vote</p>
                <p className="text-ink-muted text-xs">Ideas the committee approves go to a vote.</p>
              </Link>
              <Link
                href={`${base}/events/${next.slug}/accounts`}
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
                const pct = fundedPercent(cs?.fundRaised ?? 0, cs?.fundTarget ?? 0);
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
                      {formatMoney(cs?.fundTarget ?? 0, community.currency)}
                    </p>
                  </Link>
                );
              })}
            </div>
          </>
        ) : null}

        {can(role, 'campaigns:propose') ? (
          <Link
            href={`${base}/events/propose`}
            className="border-border-base bg-surface-raised hover:bg-surface-sunken mt-8 flex items-center justify-between gap-3 rounded-xl border p-4"
          >
            <span className="flex items-center gap-3">
              <Megaphone className="text-accent size-5" aria-hidden="true" />
              <span>
                <span className="text-ink block text-sm font-semibold">
                  Start a fundraising campaign
                </span>
                <span className="text-ink-muted block text-xs">
                  Raise money for something the society needs. The committee approves it first.
                </span>
              </span>
            </span>
            <ArrowRight className="text-ink-subtle size-4" aria-hidden="true" />
          </Link>
        ) : null}
      </PageBody>
    </>
  );
}
