import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCapability } from '@/lib/auth';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { CampaignForm } from './campaign-form';

export const metadata = { title: 'Start a fundraising campaign' };

export default async function ProposeCampaignPage(
  props: PageProps<'/app/[community]/events/propose'>,
) {
  const { community: slug } = await props.params;
  await requireCapability(slug, 'campaigns:propose');

  return (
    <>
      <PageHeader
        title="Start a fundraising campaign"
        description="The committee reviews it first. Once approved, every resident can see it and contribute."
      />
      <PageBody>
        <Link
          href={`/app/${slug}/events`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All events
        </Link>
        <div className="mx-auto max-w-xl">
          <Card>
            <CardBody>
              <CampaignForm slug={slug} />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
