import Link from 'next/link';
import { ClipboardCheck, Lightbulb, Megaphone, Receipt } from 'lucide-react';
import { formatDate, formatMoney, relativeTime } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/field';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { BillLink } from '@/components/bill-link';
import { ReviewExpenseForm } from '../events/[event]/forms';
import { decideCampaign, decideSuggestion } from '../events/actions';

export const metadata = { title: 'Committee approvals' };

/** Everything waiting on a committee decision, in one place. */
export default async function ApprovalsPage(props: PageProps<'/app/[community]/admin/approvals'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'expenses:approve');
  const supabase = await getSupabase();
  const base = `/app/${community.slug}`;

  const [bills, campaigns, suggestions] = await Promise.all([
    supabase
      .from('expenses')
      .select(
        'id, name, category, amount, vendor, bill_url, spent_on, created_at, events(slug, name), requester:memberships!expenses_requested_by_fkey(profiles(full_name))',
      )
      .eq('community_id', community.id)
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('events')
      .select(
        'id, slug, emoji, name, description, fund_target, starts_on, created_at, profiles(full_name)',
      )
      .eq('community_id', community.id)
      .eq('status', 'proposed')
      .order('created_at'),
    supabase
      .from('activity_suggestions')
      .select(
        'id, kind, name, description, created_at, events(slug, name), memberships(profiles(full_name))',
      )
      .eq('community_id', community.id)
      .eq('status', 'new')
      .order('created_at'),
  ]);

  const nothing = !bills.data?.length && !campaigns.data?.length && !suggestions.data?.length;

  return (
    <>
      <PageHeader
        title="Committee approvals"
        description="Bills, fundraising campaigns and suggestions waiting for a committee decision."
      />
      <PageBody>
        {nothing ? (
          <Card>
            <EmptyState
              icon={<ClipboardCheck className="size-6" />}
              title="All caught up"
              description="Nothing is waiting for the committee."
            />
          </Card>
        ) : null}

        {bills.data?.length ? (
          <Card>
            <CardHeader
              title={`Bills (${bills.data.length})`}
              description="Approving publishes a bill to every resident. Nobody approves a bill they uploaded."
            />
            <ul className="divide-border-base divide-y">
              {bills.data.map((bill) => (
                <li key={bill.id} className="space-y-3 px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink flex items-center gap-2 text-sm font-semibold">
                        <Receipt className="text-ink-muted size-4" aria-hidden="true" />
                        {bill.name} · {formatMoney(bill.amount, community.currency)}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {[bill.category, bill.vendor, formatDate(bill.spent_on)]
                          .filter(Boolean)
                          .join(' · ')}
                        {bill.requester?.profiles?.full_name
                          ? ` · uploaded by ${bill.requester.profiles.full_name}`
                          : ''}
                      </p>
                      {bill.events?.slug ? (
                        <Link
                          href={`${base}/admin/events/${bill.events.slug}?tab=bills`}
                          className="text-accent text-xs hover:underline"
                        >
                          {bill.events.name}
                        </Link>
                      ) : null}
                      <div>
                        <BillLink url={bill.bill_url} />
                      </div>
                    </div>
                    <Badge tone="warning">Pending</Badge>
                  </div>
                  <ReviewExpenseForm
                    slug={slug}
                    eventSlug={bill.events?.slug ?? ''}
                    expenseId={bill.id}
                  />
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {campaigns.data?.length ? (
          <Card className="mt-5">
            <CardHeader
              title={`Fundraising campaigns (${campaigns.data.length})`}
              description="Proposed by residents. Approving puts the campaign in front of everyone."
            />
            <ul className="divide-border-base divide-y">
              {campaigns.data.map((campaign) => (
                <li key={campaign.id} className="px-5 py-4">
                  <p className="text-ink flex items-center gap-2 text-sm font-semibold">
                    <Megaphone className="text-ink-muted size-4" aria-hidden="true" />
                    {campaign.emoji} {campaign.name} ·{' '}
                    {formatMoney(campaign.fund_target, community.currency)} target
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    Proposed by {campaign.profiles?.full_name ?? 'a resident'}{' '}
                    {relativeTime(campaign.created_at)} · from {formatDate(campaign.starts_on)}
                  </p>
                  {campaign.description ? (
                    <p className="text-ink-muted mt-2 text-sm">{campaign.description}</p>
                  ) : null}
                  <div className="mt-3 flex gap-2">
                    <form action={decideCampaign}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="event_id" value={campaign.id} />
                      <input type="hidden" name="approve" value="1" />
                      <Button type="submit" size="sm">
                        Approve campaign
                      </Button>
                    </form>
                    <form action={decideCampaign}>
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="event_id" value={campaign.id} />
                      <input type="hidden" name="approve" value="0" />
                      <Button type="submit" size="sm" variant="ghost">
                        Turn down
                      </Button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {suggestions.data?.length ? (
          <Card className="mt-5">
            <CardHeader
              title={`Suggestions (${suggestions.data.length})`}
              description="Approving opens a suggestion for residents to vote on."
            />
            <ul className="divide-border-base divide-y">
              {suggestions.data.map((suggestion) => (
                <li key={suggestion.id} className="px-5 py-4">
                  <p className="text-ink flex items-center gap-2 text-sm font-semibold">
                    <Lightbulb className="text-ink-muted size-4" aria-hidden="true" />
                    {suggestion.name}
                    <Badge tone="neutral">{suggestion.kind === 'idea' ? 'Idea' : 'Activity'}</Badge>
                  </p>
                  <p className="text-ink-subtle mt-0.5 text-xs">
                    {suggestion.memberships?.profiles?.full_name ?? 'A resident'} ·{' '}
                    {relativeTime(suggestion.created_at)}
                    {suggestion.events?.name ? ` · ${suggestion.events.name}` : ''}
                  </p>
                  {suggestion.description ? (
                    <p className="text-ink-muted mt-2 text-sm">{suggestion.description}</p>
                  ) : null}
                  <form
                    action={decideSuggestion}
                    className="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="slug" value={slug} />
                    <input type="hidden" name="suggestion_id" value={suggestion.id} />
                    <label htmlFor={`sn-${suggestion.id}`} className="sr-only">
                      Note
                    </label>
                    <Input
                      id={`sn-${suggestion.id}`}
                      name="note"
                      placeholder="Note (optional)"
                      className="w-56"
                    />
                    <Button type="submit" size="sm" name="approve" value="1">
                      Open for voting
                    </Button>
                    <Button type="submit" size="sm" variant="ghost" name="approve" value="0">
                      Decline
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
        <CardBody className="px-0">
          <p className="text-ink-subtle text-xs">Closing an event is on each event’s Close tab.</p>
        </CardBody>
      </PageBody>
    </>
  );
}
