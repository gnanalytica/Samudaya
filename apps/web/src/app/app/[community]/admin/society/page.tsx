import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { requireCapability } from '@/lib/auth';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody } from '@/components/ui/card';
import { SocietyDetailsForm } from './society-form';

export const metadata = { title: 'Society details' };

export default async function SocietyDetailsPage(
  props: PageProps<'/app/[community]/admin/society'>,
) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'roles:manage');

  return (
    <>
      <PageHeader title="Society details" description="How residents see your society." />
      <PageBody>
        <div className="mx-auto max-w-2xl">
          <Link
            href={`/app/${community.slug}/admin/settings`}
            className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Society settings
          </Link>
          <Card>
            <CardBody>
              <SocietyDetailsForm
                slug={community.slug}
                name={community.name}
                address={community.address}
                pincode={community.pincode}
                city={community.city}
              />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
