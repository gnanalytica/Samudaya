import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
  normalizeRole,
  normalizeStats,
  setupProgress,
  setupSteps,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchEvents, fetchStats, pickNextEvent } from '../../src/lib/events';
import { fetchSetupFacts } from '../../src/lib/setup';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { LinkRow } from '../../src/components/admin-ui';
import { Meter, StatTile } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

export default function Home() {
  const router = useRouter();
  const { profile, activeCommunity, role } = useAuth();
  const staffView = can(role, 'events:manage');
  const setupOpen = can(role, 'roles:manage') && !activeCommunity?.setup_completed_at;

  const { data, loading, refreshing, refresh } = useCommunityData(
    `home:${role}`,
    async (communityId) => {
      const events = await fetchEvents(communityId);
      const next = pickNextEvent(events);
      const [stats, requests, bills, proposals] = await Promise.all([
        next ? fetchStats([next.id]) : Promise.resolve(new Map()),
        staffView
          ? supabase
              .from('join_requests')
              .select('id', { count: 'exact', head: true })
              .eq('community_id', communityId)
              .eq('status', 'pending')
          : Promise.resolve({ count: 0 }),
        staffView
          ? supabase
              .from('expenses')
              .select('id', { count: 'exact', head: true })
              .eq('community_id', communityId)
              .in('status', ['pending', 'changes_requested'])
          : Promise.resolve({ count: 0 }),
        can(role, 'campaigns:approve')
          ? supabase
              .from('events')
              .select('id', { count: 'exact', head: true })
              .eq('community_id', communityId)
              .eq('status', 'proposed')
          : Promise.resolve({ count: 0 }),
      ]);
      return {
        next: next ?? null,
        stats: next ? (stats.get(next.id) ?? normalizeStats(null)) : normalizeStats(null),
        pendingRequests: requests.count ?? 0,
        openBills: bills.count ?? 0,
        proposals: proposals.count ?? 0,
      };
    },
  );

  // The committee's setup checklist, until they finish it.
  const setup = useCommunityData(
    `home:setup:${setupOpen}:${activeCommunity?.address ?? ''}:${activeCommunity?.upi_vpa ?? ''}:${activeCommunity?.catalogue_reviewed_at ?? ''}`,
    async () => (setupOpen && activeCommunity ? fetchSetupFacts(activeCommunity) : null),
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const firstName = profile?.full_name?.split(' ')[0];
  const currency = activeCommunity?.currency ?? 'INR';
  const next = data?.next;
  const stats = data?.stats ?? normalizeStats(null);
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const normalized = normalizeRole(role);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: 2 }}>
          <Title>{firstName ? `Hello, ${firstName}` : 'Home'}</Title>
          <Caption>
            {activeCommunity?.name ?? ''}
            {normalized ? ` · ${ROLE_LABEL[normalized]}` : ''}
          </Caption>
        </View>

        {setupOpen && setup.data ? (
          <SetupCard steps={setupSteps(setup.data)} onOpen={() => router.push('/admin/setup')} />
        ) : null}

        {staffView ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>Needs attention</Heading>
            <LinkRow
              label={`Join requests (${data?.pendingRequests ?? 0})`}
              detail="New residents waiting to be admitted"
              onPress={() => router.push('/admin/requests')}
            />
            <LinkRow
              label={`Bills in progress (${data?.openBills ?? 0})`}
              detail={
                can(role, 'expenses:approve')
                  ? 'Waiting for committee approval or corrections'
                  : 'Pending approval or sent back for corrections'
              }
              onPress={() => router.push('/admin/bills')}
            />
            {can(role, 'campaigns:approve') ? (
              <LinkRow
                label={`Committee decisions (${data?.proposals ?? 0} campaigns)`}
                detail="Proposed campaigns and new suggestions"
                onPress={() => router.push('/admin/queue')}
              />
            ) : null}
          </Card>
        ) : null}

        {next ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <View style={{ gap: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body>{next.emoji}</Body>
                  {next.kind === 'campaign' ? <Badge label="Campaign" tone="info" /> : null}
                </View>
                <Heading>{next.name}</Heading>
                <Caption>
                  {formatDate(next.starts_on)}
                  {next.venue ? ` · ${next.venue}` : ''}
                  {countdown(next.starts_on) ? ` · ${countdown(next.starts_on)}` : ''}
                </Caption>
              </View>

              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Caption>
                    {formatMoney(stats.fundRaised, currency)} of{' '}
                    {formatMoney(stats.fundTarget, currency)}
                  </Caption>
                  <Caption>{funded}%</Caption>
                </View>
                <Meter percent={funded} tone="success" label="Fund progress" />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="View event"
                    variant={can(role, 'contribute') ? 'secondary' : 'primary'}
                    onPress={() => router.push(`/event/${next.slug}`)}
                  />
                </View>
                {can(role, 'contribute') ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      label="Contribute"
                      onPress={() => router.push(`/contribute?event=${next.slug}`)}
                    />
                  </View>
                ) : null}
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile label="RAISED" value={formatMoney(stats.fundRaised, currency)} />
              <StatTile label="SPENT" value={formatMoney(stats.spent, currency)} />
              <StatTile label="FAMILIES" value={String(stats.contributors)} />
            </View>
          </>
        ) : (
          <Card>
            <EmptyState
              title="Nothing planned yet"
              description="When the society plans an event, it will show up here."
            />
          </Card>
        )}

        {can(role, 'campaigns:propose') ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Raising money for something?</Heading>
            <Body muted>
              Propose a fundraising campaign. The committee reviews it before residents can
              contribute.
            </Body>
            <Button
              label="Start a campaign"
              variant="secondary"
              onPress={() => router.push('/campaign/new')}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SetupCard({
  steps,
  onOpen,
}: {
  steps: ReturnType<typeof setupSteps>;
  onOpen: () => void;
}) {
  const progress = setupProgress(steps);
  const next = steps.find((step) => !step.done);
  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Set up your society</Heading>
        <Caption>
          {progress.done} of {progress.total} done
          {next ? ` · next: ${next.title}` : ' · all steps done'}
        </Caption>
      </View>
      <Meter
        percent={Math.round((progress.done / progress.total) * 100)}
        tone="success"
        label="Setup progress"
      />
      <Button label={next ? 'Continue setup' : 'Review and finish'} onPress={onOpen} />
    </Card>
  );
}
