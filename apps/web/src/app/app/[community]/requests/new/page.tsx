import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { RequestForm } from './request-form';

export const metadata = { title: 'New request' };

export default async function NewRequestPage(props: PageProps<'/app/[community]/requests/new'>) {
  const { community: slug } = await props.params;
  const { community, unitIds } = await requireCommunity(slug);
  const supabase = await getSupabase();

  // Residents pick from the flats they occupy; staff with none get no picker.
  const { data: units } = unitIds.length
    ? await supabase.from('units').select('id, block, number').in('id', unitIds).order('number')
    : { data: [] };

  return (
    <>
      <PageHeader
        title="Raise a request"
        description="The committee will see this straight away."
      />
      <PageBody>
        <Link
          href={`/app/${community.slug}/requests`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All requests
        </Link>
        <Card className="max-w-2xl">
          <CardBody>
            <RequestForm slug={slug} units={units ?? []} />
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
