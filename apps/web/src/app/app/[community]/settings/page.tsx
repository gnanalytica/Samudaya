import { ROLE_DESCRIPTION, ROLE_LABEL, normalizeRole, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfileCard } from './profile-card';
import { DeleteAccountCard } from './delete-account-card';

export const metadata = { title: 'Settings' };

export default async function SettingsPage(props: PageProps<'/app/[community]/settings'>) {
  const { community: slug } = await props.params;
  const { community, role: rawRole, profile, user, unitIds } = await requireCommunity(slug);
  const role = normalizeRole(rawRole) ?? 'resident';
  const supabase = await getSupabase();

  const units = unitIds.length
    ? await supabase.from('units').select('block, number').in('id', unitIds)
    : { data: [] as { block: string | null; number: string }[] };
  const myUnits = (units.data ?? []).map((unit) => unitLabel(unit)).join(', ');

  return (
    <>
      <PageHeader title="Settings" description={community.name} />
      <PageBody>
        <div className="grid max-w-3xl gap-5">
          <ProfileCard
            slug={slug}
            fullName={profile?.full_name ?? ''}
            email={profile?.email ?? user.email ?? ''}
            phone={profile?.phone ?? ''}
          />

          <Card>
            <CardHeader title="Your membership" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Community</dt>
                  <dd className="text-ink text-right font-medium">{community.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Role</dt>
                  <dd className="text-ink text-right font-medium">{ROLE_LABEL[role]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Flat</dt>
                  <dd className="text-ink text-right font-medium">{myUnits || 'Not assigned'}</dd>
                </div>
              </dl>
              <p className="text-ink-subtle mt-3 text-xs">{ROLE_DESCRIPTION[role]}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Session" />
            <CardBody>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="secondary" size="sm">
                  Sign out
                </Button>
              </form>
            </CardBody>
          </Card>

          <DeleteAccountCard />
        </div>
      </PageBody>
    </>
  );
}
