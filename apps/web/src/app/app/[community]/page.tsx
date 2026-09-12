import Link from 'next/link';
import { ArrowRight, Bell, CalendarDays, HandHeart, Lightbulb, Sparkles } from 'lucide-react';
import {
  can,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
  relativeTime,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { listEvents, getStatsFor } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ReadinessBar, StatTile } from '@/components/badges';

export default async function DashboardPage(props: PageProps<'/app/[community]'>) {
  const { community: slug } = await props.params;
  const { joined, welcome } = await props.searchParams;
  const { community, role, profile } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const base = `/app/${community.slug}`;
  const now = new Date().toISOString();

  const events = await listEvents(community.id);
  const published = events.filter((event) => event.status === 'published');
  // The soonest event that has not happened yet is the one residents care
  // about; fall back to the most recent if everything is in the past.
  const today = new Date().toISOString().slice(0, 10);
  const next =
    published
      .filter((event) => event.starts_on >= today)
      .sort((a, b) => a.starts_on.localeCompare(b.starts_on))[0] ?? published[0];

  const [stats, notices] = await Promise.all([
    getStatsFor(next ? [next.id] : []),
    supabase
      .from('announcements')
      .select('id, title, body, published_at, is_pinned')
      .eq('community_id', community.id)
      .lte('published_at', now)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order('is_pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(3),
  ]);

  const s = next ? stats.get(next.id) : undefined;
  const funded = fundedPercent(s?.fundRaised ?? 0, s?.fundTarget ?? 0);
  const firstName = profile?.full_name?.split(' ')[0];

  return (
    <>
      <PageHeader
        title={firstName ? `Hello, ${firstName}` : community.name}
        description={community.name}
      />

      <PageBody>
        {joined || welcome ? (
          <div className="border-brand-200 bg-brand-50 dark:border-brand-800 dark:bg-brand-950 mb-5 flex items-start gap-3 rounded-xl border p-4">
            <Sparkles className="text-accent mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div className="text-sm">
              <p className="text-ink font-medium">
                {welcome ? `${community.name} is ready.` : `You’ve joined ${community.name}.`}
              </p>
              <p className="text-ink-muted mt-0.5">
                {welcome
                  ? 'Next: add your flats, then create your first event.'
                  : 'Have a look at what’s coming up, and chip in if you’d like.'}
              </p>
              {welcome && can(role, 'units:manage') ? (
                <Link
                  href={`${base}/admin/units`}
                  className="text-accent mt-2 inline-flex items-center gap-1 font-medium underline underline-offset-4"
                >
                  Add flats
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : null}
            </div>
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
                  <ButtonLink href={`${base}/events/${next.slug}/contribute`} size="sm">
                    Contribute
                  </ButtonLink>
                </div>
              </div>

              <div className="border-border-base grid grid-cols-3 gap-3 border-t p-4">
                <StatTile label="Ready" value={`${s?.readiness ?? 0}%`} />
                <StatTile label="Performing" value={String(s?.participants ?? 0)} />
                <StatTile label="Volunteering" value={String(s?.volunteers ?? 0)} />
              </div>

              <div className="px-4 pb-4">
                <ReadinessBar percent={s?.readiness ?? 0} />
                <p className="text-ink-subtle mt-2 text-xs">
                  {s?.tasksDone ?? 0} of {s?.tasksTotal ?? 0} tasks complete
                </p>
              </div>
            </div>

            <h2 className="text-ink-soft mt-8 mb-3 text-sm font-semibold">Get involved</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href={`${base}/events/${next.slug}#activities`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <CalendarDays className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Perform</p>
                <p className="text-ink-muted text-xs">Dance, sing, or take the stage.</p>
              </Link>
              <Link
                href={`${base}/events/${next.slug}#volunteer`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <HandHeart className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Volunteer</p>
                <p className="text-ink-muted text-xs">Lend a hand where it’s needed.</p>
              </Link>
              <Link
                href={`${base}/feed#suggest`}
                className="border-border-base bg-surface-raised hover:bg-surface-sunken rounded-xl border p-4 transition-colors"
              >
                <Lightbulb className="text-accent size-5" aria-hidden="true" />
                <p className="text-ink mt-2 text-sm font-semibold">Suggest something</p>
                <p className="text-ink-muted text-xs">Send an idea to the committee.</p>
              </Link>
            </div>
          </>
        ) : (
          <Card>
            <EmptyState
              icon={<CalendarDays className="size-6" />}
              title="Nothing planned yet"
              description={
                can(role, 'events:prepare')
                  ? 'Create your first event and residents can start taking part.'
                  : 'When the committee plans something, it will show up here.'
              }
              action={
                can(role, 'events:prepare') ? (
                  <ButtonLink href={`${base}/admin/events/new`} size="sm">
                    Create an event
                  </ButtonLink>
                ) : undefined
              }
            />
          </Card>
        )}

        <Card className="mt-8">
          <CardHeader
            title="Latest notices"
            action={
              <Link href={`${base}/notices`} className="text-accent text-sm hover:underline">
                All
              </Link>
            }
          />
          {notices.data?.length ? (
            <ul className="divide-border-base divide-y">
              {notices.data.map((notice) => (
                <li key={notice.id} className="px-5 py-3">
                  <p className="text-ink flex items-center gap-2 text-sm font-medium">
                    {notice.is_pinned ? (
                      <span
                        className="bg-accent inline-block size-1.5 rounded-full"
                        aria-label="Pinned"
                      />
                    ) : null}
                    {notice.title}
                  </p>
                  <p className="text-ink-muted mt-0.5 line-clamp-2 text-sm">{notice.body}</p>
                  <p className="text-ink-subtle mt-1 text-xs">
                    {relativeTime(notice.published_at)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <CardBody>
              <EmptyState
                icon={<Bell className="size-6" />}
                title="No notices yet"
                description="Announcements from the committee will show up here."
              />
            </CardBody>
          )}
        </Card>
      </PageBody>
    </>
  );
}
