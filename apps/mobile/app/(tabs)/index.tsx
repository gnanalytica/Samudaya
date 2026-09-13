import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  TODO_KIND,
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
import { fetchEvents, fetchStats, pickNextEvent } from '../../src/lib/events';
import { fetchSetupFacts } from '../../src/lib/setup';
import { groupTodo, useTodoItems } from '../../src/lib/todo';
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
import { ResidentViewBanner } from '../../src/components/view-switch';
import { Meter, StatTile } from '../../src/components/event-ui';
import { todoTitle } from '../../src/components/todo-queue';
import { spacing } from '../../src/lib/theme';

export default function Home() {
  const router = useRouter();
  // The committee's resident view renders Home exactly as residents see it.
  const { profile, activeCommunity, viewRole: role } = useAuth();
  const staffView = can(role, 'events:manage');
  const setupOpen = can(role, 'roles:manage') && !activeCommunity?.setup_completed_at;
  const { data: todoData } = useTodoItems();
  const todoItems = todoData ?? [];
  const todoGroups = groupTodo(todoItems);

  const { data, loading, refreshing, refresh } = useCommunityData(
    `home:${role}`,
    async (communityId) => {
      const events = await fetchEvents(communityId);
      const next = pickNextEvent(events);
      const stats = next
        ? await fetchStats([next.id])
        : new Map<string, ReturnType<typeof normalizeStats>>();
      return {
        next: next ?? null,
        stats: next ? (stats.get(next.id) ?? normalizeStats(null)) : normalizeStats(null),
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

        <ResidentViewBanner />

        {setupOpen && setup.data ? (
          <SetupCard steps={setupSteps(setup.data)} onOpen={() => router.push('/admin/setup')} />
        ) : null}

        {staffView ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>{todoTitle(todoItems.length)}</Heading>
            {todoGroups.length ? (
              todoGroups.map((group) => (
                <LinkRow
                  key={group.kind}
                  label={`${TODO_KIND[group.kind].emoji} ${TODO_KIND[group.kind].section} (${group.items.length})`}
                  onPress={() => router.push('/manage')}
                />
              ))
            ) : (
              <Caption>Nothing waiting on you.</Caption>
            )}
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
              <StatTile label="HOUSEHOLDS" value={String(stats.contributors)} />
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
