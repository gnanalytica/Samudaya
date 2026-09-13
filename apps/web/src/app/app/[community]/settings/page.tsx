import { ROLE_DESCRIPTION, ROLE_LABEL, unitLabel } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProfileCard } from './profile-card';
import { WhatsAppCard } from './whatsapp-card';

export const metadata = { title: 'Settings' };

export default async function SettingsPage(props: PageProps<'/app/[community]/settings'>) {
  const { community: slug } = await props.params;
  const { community, role, membership, profile, user, unitIds } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const [link, units] = await Promise.all([
    supabase
      .from('whatsapp_links')
      .select('phone, verified_at')
      .eq('user_id', user.id)
      .maybeSingle(),
    unitIds.length
      ? supabase.from('units').select('block, number').in('id', unitIds)
      : Promise.resolve({ data: [] as { block: string | null; number: string }[] }),
  ]);

  const linkedPhone = link.data?.verified_at ? link.data.phone : null;
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
          />

          <WhatsAppCard
            slug={slug}
            linkedPhone={linkedPhone}
            botNumber={process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? null}
          />

          <Card>
            <CardHeader title="Your membership" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Community</dt>
                  <dd className="text-ink text-right font-medium">{community.name}</dd>
                </div>
                {membership.title ? (
                  <div className="flex justify-between gap-4">
                    <dt className="text-ink-muted">Title</dt>
                    <dd className="text-ink text-right font-medium">{membership.title}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Role</dt>
                  <dd className="text-ink text-right font-medium">{ROLE_LABEL[role]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Unit</dt>
                  <dd className="text-ink text-right font-medium">{myUnits || 'Not assigned'}</dd>
                </div>
              </dl>
              <p className="text-ink-subtle mt-3 text-xs">{ROLE_DESCRIPTION[role]}</p>
              {membership.approves_spending ? (
                <p className="text-ink-subtle mt-1 text-xs">
                  You are a designated spending approver.
                </p>
              ) : null}
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
        </div>
      </PageBody>
    </>
  );
}
