import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCapability } from '@/lib/auth';
import { PageBody, PageHeader } from '@/components/page-header';
import { EventWizard } from './wizard';

export const metadata = { title: 'Create an event' };

export default async function NewEventPage(props: PageProps<'/app/[community]/admin/events/new'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'events:prepare');

  return (
    <>
      <PageHeader
        title="Create an event"
        description="Budget, checklist and surplus rule — settled before anybody contributes."
      />
      <PageBody>
        <Link
          href={`/app/${slug}/admin`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Admin console
        </Link>
        <EventWizard communitySlug={slug} currency={community.currency} />
      </PageBody>
    </>
  );
}
