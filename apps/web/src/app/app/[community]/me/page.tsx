import Link from 'next/link';
import { CalendarDays, Lightbulb, Megaphone, Receipt } from 'lucide-react';
import {
  EVENT_STATUS_LABEL,
  ROLE_LABEL,
  canParticipate,
  formatDate,
  formatMoney,
  normalizeRole,
  receiptRef,
  unitLabel,
} from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader, CardBody } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PaymentStatusBadge, StatTile } from '@/components/badges';

export const metadata = { title: 'Me' };

const SUGGESTION_STATUS = {
  new: 'With the committee',
  reviewing: 'With the committee',
  accepted: 'Open for voting',
  declined: 'Declined',
} as const;

export default async function MyActivityPage(props: PageProps<'/app/[community]/me'>) {
  const { community: slug } = await props.params;
  const { community, role, profile, membership, unitIds, user } = await requireCommunity(slug);
  const supabase = await getSupabase();
  const base = `/app/${slug}`;

  const [contributions, registrations, suggestions, campaigns, units] = await Promise.all([
    supabase
      .from('contributions')
      .select(
        'id, amount, method, status, reference, review_note, receipt_no, paid_at, events(slug, name, emoji)',
      )
      .eq('membership_id', membership.id)
      .order('paid_at', { ascending: false })
      .limit(50),
    supabase
      .from('activity_participants')
      .select('id, participant_name, joined_at, event_activities(name, emoji, events(slug, name))')
      .eq('membership_id', membership.id)
      .order('joined_at', { ascending: false }),
    supabase
      .from('activity_suggestions')
      .select('id, kind, name, status, review_note, created_at, events(slug, name)')
      .eq('suggested_by', membership.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('events')
      .select('id, slug, emoji, name, status, fund_target, created_at')
      .eq('community_id', community.id)
      .eq('kind', 'campaign')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false }),
    unitIds.length
      ? supabase.from('units').select('block, number').in('id', unitIds)
      : Promise.resolve({ data: [] as { block: string | null; number: string }[] }),
  ]);

  // Only confirmed payments count; reported ones are still waiting for staff.
  const totalGiven = (contributions.data ?? [])
    .filter((row) => row.status === 'succeeded')
    .reduce((sum, row) => sum + Number(row.amount), 0);
  const myUnits = (units.data ?? []).map((unit) => unitLabel(unit)).join(', ');
  const roleLabel = ROLE_LABEL[normalizeRole(role) ?? 'resident'];

  return (
    <>
      <PageHeader
        title={profile?.full_name ?? 'Me'}
        description={[community.name, roleLabel, myUnits].filter(Boolean).join(' · ')}
      />
      <PageBody>
        {!canParticipate(role) ? (
          <Card className="mb-5">
            <CardBody className="text-ink-muted text-sm">
              As staff you run events from Manage and clear your To do list. Contributing, voting
              and suggesting are for residents and the committee.
            </CardBody>
          </Card>
        ) : null}

        <div className="grid grid-cols-3 gap-3">
          <StatTile label="Contributed" value={formatMoney(totalGiven, community.currency)} />
          <StatTile label="Registrations" value={String(registrations.data?.length ?? 0)} />
          <StatTile label="Suggestions" value={String(suggestions.data?.length ?? 0)} />
        </div>

        <Card className="mt-5">
          <CardHeader title="Your payments" />
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
                        {contribution.status === 'succeeded'
                          ? receiptRef(contribution.events?.slug, contribution.receipt_no)
                          : (contribution.reference ?? 'UPI payment')}
                      </span>
                      {' · '}
                      {formatDate(contribution.paid_at.slice(0, 10))}
                    </p>
                    {contribution.status === 'failed' && contribution.review_note ? (
                      <p className="text-danger mt-1 text-xs">{contribution.review_note}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-ink text-sm font-semibold">
                      {formatMoney(contribution.amount, community.currency)}
                    </span>
                    <PaymentStatusBadge status={contribution.status} />
                  </div>
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
            <CardHeader title="Activity registrations" />
            {registrations.data?.length ? (
              <ul className="divide-border-base divide-y">
                {registrations.data.map((row) => (
                  <li key={row.id} className="px-5 py-3">
                    <p className="text-ink text-sm font-medium">
                      {row.event_activities?.emoji} {row.event_activities?.name}
                      {row.participant_name ? (
                        <span className="text-ink-muted font-normal">
                          {' '}
                          · {row.participant_name}
                        </span>
                      ) : null}
                    </p>
                    {row.event_activities?.events?.slug ? (
                      <Link
                        href={`${base}/events/${row.event_activities.events.slug}?tab=activities`}
                        className="text-ink-subtle mt-0.5 text-xs hover:underline"
                      >
                        {row.event_activities.events.name}
                      </Link>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<CalendarDays className="size-6" />}
                title="No registrations yet"
                description="Register yourself or your family for an event’s activities."
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Your suggestions" />
            {suggestions.data?.length ? (
              <ul className="divide-border-base divide-y">
                {suggestions.data.map((row) => (
                  <li key={row.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">{row.name}</p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {row.kind === 'idea' ? 'Idea' : 'Activity'}
                        {row.events?.name ? ` · ${row.events.name}` : ''}
                        {row.review_note ? ` · “${row.review_note}”` : ''}
                      </p>
                    </div>
                    <Badge
                      tone={
                        row.status === 'accepted'
                          ? 'success'
                          : row.status === 'declined'
                            ? 'neutral'
                            : 'warning'
                      }
                    >
                      {SUGGESTION_STATUS[row.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Lightbulb className="size-6" />}
                title="No suggestions yet"
                description="Suggest an idea or activity from any event page."
              />
            )}
          </Card>
        </div>

        {campaigns.data?.length ? (
          <Card className="mt-5">
            <CardHeader title="Campaigns you proposed" />
            <ul className="divide-border-base divide-y">
              {campaigns.data.map((campaign) => (
                <li key={campaign.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link
                    href={`${base}/events/${campaign.slug}`}
                    className="min-w-0 hover:underline"
                  >
                    <p className="text-ink flex items-center gap-2 text-sm font-medium">
                      <Megaphone className="text-ink-muted size-4" aria-hidden="true" />
                      {campaign.emoji} {campaign.name}
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      Target {formatMoney(campaign.fund_target, community.currency)}
                    </p>
                  </Link>
                  <Badge
                    tone={
                      campaign.status === 'published'
                        ? 'success'
                        : campaign.status === 'proposed'
                          ? 'warning'
                          : 'neutral'
                    }
                  >
                    {campaign.status === 'cancelled'
                      ? 'Turned down'
                      : EVENT_STATUS_LABEL[campaign.status]}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}
