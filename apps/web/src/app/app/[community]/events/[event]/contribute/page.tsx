import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { can, formatDate, formatMoney, fundBarSegments, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { getEventStats, requireEvent } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { FundBar, PaymentStatusBadge } from '@/components/badges';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ContributeForm } from './contribute-form';

export const metadata = { title: 'Contribute' };

export default async function ContributePage(
  props: PageProps<'/app/[community]/events/[event]/contribute'>,
) {
  const { community: slug, event: eventSlug } = await props.params;
  const { amount } = await props.searchParams;
  const { community, role, membership, unitIds } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);

  // A closed or draft event has no open fund, and staff do not contribute.
  if (event.status !== 'published' || !can(role, 'contribute')) notFound();

  const supabase = await getSupabase();
  const [stats, flat, mine] = await Promise.all([
    getEventStats(event.id),
    unitIds[0]
      ? supabase.from('units').select('block, number').eq('id', unitIds[0]).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('contributions')
      .select('id, amount, status, reference, review_note, paid_at')
      .eq('event_id', event.id)
      .eq('membership_id', membership.id)
      .order('paid_at', { ascending: false }),
  ]);
  const bar = fundBarSegments(
    stats.fundRaised,
    stats.fundPending,
    stats.fundTarget,
    stats.fundCarried,
  );
  const funded = bar.confirmed;

  const suggested = Number.parseInt(typeof amount === 'string' ? amount : '', 10);

  return (
    <>
      <PageHeader
        title={`Support ${event.name}`}
        description={`Your contribution goes to the ${event.name} fund and nowhere else.`}
      />
      <PageBody>
        <Link
          href={`/app/${slug}/events/${event.slug}?tab=money`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the event
        </Link>

        <div className="mx-auto max-w-3xl">
          <div className="border-border-base bg-surface-sunken mb-5 rounded-xl border p-4">
            <div className="text-ink-muted flex justify-between text-sm font-medium">
              <span>
                {formatMoney(stats.fundRaised, community.currency)} of{' '}
                {formatMoney(stats.fundTarget, community.currency)}
              </span>
              <span>{funded}%</span>
            </div>
            <div className="mt-2">
              <FundBar percent={funded} pendingPercent={bar.pending} carriedPercent={bar.carried} />
            </div>
            <p className="text-ink-subtle mt-2 text-xs">
              Confirmed payments only. {stats.contributors}{' '}
              {stats.contributors === 1 ? 'household has' : 'households have'} contributed so far.
              {stats.fundPending > 0 ? (
                <>
                  {' '}
                  A further {formatMoney(stats.fundPending, community.currency)} from{' '}
                  {stats.pendingContributors}{' '}
                  {stats.pendingContributors === 1 ? 'household is' : 'households are'} waiting to
                  be matched against the bank.
                </>
              ) : null}
            </p>
          </div>

          {community.upi_vpa && community.upi_payee_name ? (
            <ContributeForm
              slug={slug}
              eventSlug={event.slug}
              eventName={event.name}
              currency={community.currency}
              suggested={Number.isFinite(suggested) && suggested > 0 ? suggested : null}
              askedPerFlat={event.suggested_amount ? Number(event.suggested_amount) : null}
              upi={{ vpa: community.upi_vpa, payeeName: community.upi_payee_name }}
              flatLabel={flat.data ? unitLabel(flat.data) : null}
              proofFolder={`${community.id}/${membership.id}`}
            />
          ) : (
            <Card>
              <CardBody className="text-ink-muted text-sm">
                Your society hasn’t set up UPI payments in the app yet. Please pay the committee
                directly for now, or ask them to add the society’s UPI ID.
              </CardBody>
            </Card>
          )}

          {mine.data?.length ? (
            <Card className="mt-5">
              <CardHeader title="Your payments for this event" />
              <ul className="divide-border-base divide-y">
                {mine.data.map((payment) => (
                  <li key={payment.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-ink text-sm font-medium">
                        {formatMoney(payment.amount, community.currency)}
                      </p>
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        {payment.reference ? (
                          <span className="font-mono">{payment.reference} · </span>
                        ) : null}
                        {formatDate(payment.paid_at.slice(0, 10))}
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
        </div>
      </PageBody>
    </>
  );
}
