import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { VisitorForm } from './visitor-form';

export const metadata = { title: 'New visitor pass' };

export default async function NewVisitorPage(props: PageProps<'/app/[community]/visitors/new'>) {
  const { community: slug } = await props.params;
  const { community, unitIds } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const { data: units } = unitIds.length
    ? await supabase.from('units').select('id, block, number').in('id', unitIds).order('number')
    : { data: [] };

  return (
    <>
      <PageHeader
        title="Invite a visitor"
        description="They’ll get a code to read out at the gate."
      />
      <PageBody>
        <Link
          href={`/app/${community.slug}/visitors`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          All visitors
        </Link>
        <Card className="max-w-2xl">
          <CardBody>
            <VisitorForm slug={slug} units={units ?? []} />
          </CardBody>
        </Card>
      </PageBody>
    </>
  );
}
