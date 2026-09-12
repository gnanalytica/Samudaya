import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { formatMoney, fundedPercent } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getEventStats, requireEvent } from '@/lib/events';
import { PageBody, PageHeader } from '@/components/page-header';
import { FundBar } from '@/components/badges';
import { ContributeForm } from './contribute-form';

export const metadata = { title: 'Contribute' };

export default async function ContributePage(
  props: PageProps<'/app/[community]/events/[event]/contribute'>,
) {
  const { community: slug, event: eventSlug } = await props.params;
  const { amount } = await props.searchParams;
  const { community } = await requireCommunity(slug);
  const event = await requireEvent(community.id, eventSlug);

  // A closed or draft event has no open fund.
  if (event.status !== 'published') notFound();

  const stats = await getEventStats(event.id);
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);

  const suggested = Number.parseInt(typeof amount === 'string' ? amount : '', 10);

  return (
    <>
      <PageHeader
        title={`Support ${event.name}`}
        description={`Your contribution goes to the ${event.name} fund and nowhere else.`}
      />
      <PageBody>
        <Link
          href={`/app/${slug}/events/${event.slug}`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to the event
        </Link>

        <div className="mx-auto max-w-xl">
          <div className="border-border-base bg-surface-sunken mb-5 rounded-xl border p-4">
            <div className="text-ink-muted flex justify-between text-sm font-medium">
              <span>
                {formatMoney(stats.fundRaised, community.currency)} of{' '}
                {formatMoney(stats.fundTarget, community.currency)}
              </span>
              <span>{funded}%</span>
            </div>
            <div className="mt-2">
              <FundBar percent={funded} />
            </div>
            <p className="text-ink-subtle mt-2 text-xs">
              {stats.contributors} families have contributed so far.
            </p>
          </div>

          <ContributeForm
            slug={slug}
            eventSlug={event.slug}
            eventName={event.name}
            currency={community.currency}
            suggested={Number.isFinite(suggested) && suggested > 0 ? suggested : null}
          />
        </div>
      </PageBody>
    </>
  );
}
