import Link from 'next/link';
import { CalendarDays, HandHeart, Receipt } from 'lucide-react';
import { ROLE_LABEL, formatDate, formatMoney, receiptRef, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile } from '@/components/badges';

export const metadata = { title: 'My activity' };

export default async function MyActivityPage(props: PageProps<'/app/[community]/me'>) {
  const { community: slug } = await props.params;
  const { community, role, profile, membership, unitIds } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const [contributions, activities, volunteering, tasks, units] = await Promise.all([
    supabase
      .from('contributions')
      .select('id, amount, method, receipt_no, paid_at, events(slug, name, emoji)')
      .eq('membership_id', membership.id)
      .eq('status', 'succeeded')
      .order('paid_at', { ascending: false })
      .limit(50),
    supabase
      .from('activity_participants')
      .select('activity_id, joined_at, event_activities(name, emoji, events(slug, name))')
      .eq('membership_id', membership.id)
      .order('joined_at', { ascending: false }),
    supabase
      .from('event_volunteers')
      .select('role_id, signed_up_at, volunteer_roles(name, emoji, events(slug, name))')
      .eq('membership_id', membership.id)
      .order('signed_up_at', { ascending: false }),
    supabase
      .from('event_tasks')
      .select('id, name, status, due_on, events(slug, name)')
      .eq('assignee_id', membership.id)
      .neq('status', 'done')
      .order('due_on', { nullsFirst: false })
      .limit(20),
    unitIds.length
      ? supabase.from('units').select('block, number').in('id', unitIds)
      : Promise.resolve({ data: [] as { block: string | null; number: string }[] }),
  ]);

  const totalGiven = (contributions.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const myUnits = (units.data ?? []).map((unit) => unitLabel(unit)).join(', ');
  const base = `/app/${slug}`;

  return (
    <>
      <PageHeader
        title={profile?.full_name ?? 'My activity'}
        description={[community.name, membership.title, ROLE_LABEL[role], myUnits]
          .filter(Boolean)
          .join(' · ')}
      />
      <PageBody>
        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Contributed" value={formatMoney(totalGiven, community.currency)} />
          <StatTile label="Performing in" value={String(activities.data?.length ?? 0)} />
          <StatTile label="Volunteering" value={String(volunteering.data?.length ?? 0)} />
        </div>

        {tasks.data?.length ? (
          <Card className="mt-5">
            <CardHeader
              title="Assigned to you"
              description="Tasks from the event checklists you help run."
            />
            <ul className="divide-border-base divide-y">
              {tasks.data.map((task) => (
                <li key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">{task.name}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {task.events?.name}
                      {task.due_on ? ` · due ${formatDate(task.due_on)}` : ''}
                    </p>
                  </div>
                  {task.events?.slug ? (
                    <Link
                      href={`${base}/events/${task.events.slug}`}
                      className="text-accent shrink-0 text-sm hover:underline"
                    >
                      Open
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        <Card className="mt-5">
          <CardHeader title="Your contributions" />
          {contributions.data?.length ? (
            <ul className="divide-border-base divide-y">
              {contributions.data.map((contribution) => (
                <li
                  key={contribution.id}
                  className="flex items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">
                      {contribution.events?.emoji} {contribution.events?.name}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      <span className="font-mono">
                        {receiptRef(contribution.events?.slug, contribution.receipt_no)}
                      </span>
                      {' · '}
                      {formatDate(contribution.paid_at.slice(0, 10))}
                    </p>
                  </div>
                  <span className="text-ink shrink-0 text-sm font-semibold">
                    {formatMoney(contribution.amount, community.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={<Receipt className="size-6" />}
              title="Nothing yet"
              description="When you contribute to an event, your receipts show up here."
            />
          )}
        </Card>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Performing in" />
            {activities.data?.length ? (
              <ul className="divide-border-base divide-y">
                {activities.data.map((row) => (
                  <li key={row.activity_id} className="px-5 py-3">
                    <p className="text-ink text-sm font-medium">
                      {row.event_activities?.emoji} {row.event_activities?.name}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {row.event_activities?.events?.name}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title="Not signed up yet"
                description="Cultural activities you join will be listed here."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Volunteering" />
            {volunteering.data?.length ? (
              <ul className="divide-border-base divide-y">
                {volunteering.data.map((row) => (
                  <li key={row.role_id} className="px-5 py-3">
                    <p className="text-ink text-sm font-medium">
                      {row.volunteer_roles?.emoji} {row.volunteer_roles?.name}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {row.volunteer_roles?.events?.name}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<HandHeart className="size-6" />}
                title="Not volunteering yet"
                description="Sign up on any event to lend a hand."
              />
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
