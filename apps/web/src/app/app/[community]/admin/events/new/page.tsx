import { requireCapability } from '@/lib/auth';
import { PageBody, PageHeader } from '@/components/page-header';
import { CreateEventForm } from './create-event-form';

export const metadata = { title: 'Create event' };

export default async function NewEventPage(props: PageProps<'/app/[community]/admin/events/new'>) {
  const { community: slug } = await props.params;
  await requireCapability(slug, 'events:manage');

  return (
    <>
      <PageHeader
        title="Create an event"
        description="It starts as a draft. Add activities and bills, then publish it to residents."
      />
      <PageBody>
        <div className="mx-auto max-w-2xl">
          <CreateEventForm slug={slug} />
        </div>
      </PageBody>
    </>
  );
}
