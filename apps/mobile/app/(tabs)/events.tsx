import { Pressable, RefreshControl, SectionList, View } from 'react-native';
import { today as localToday } from '../../src/components/date-field';
import { useRouter } from 'expo-router';
import {
  EVENT_STATUS_LABEL,
  alreadyInFundLine,
  awaitingLine,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundAsk,
  fundBarSegments,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { fetchEvents, fetchStats } from '../../src/lib/events';
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
} from '../../src/components/ui';
import { Meter } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

export default function Events() {
  const router = useRouter();
  const { activeCommunity, viewRole: role, user } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const { data, loading, refreshing, refresh } = useCommunityData('events', async (communityId) => {
    const events = await fetchEvents(communityId);
    const stats = await fetchStats(events.map((event) => event.id));
    return events.map((event) => ({ ...event, stats: stats.get(event.id) }));
  });

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const rows = data ?? [];
  const today = localToday();
  const inPlay = (row: (typeof rows)[number]) =>
    row.status === 'published' || row.status === 'draft';

  const sections = [
    {
      title: 'Proposals waiting for the committee',
      data: rows.filter(
        (row) =>
          row.status === 'proposed' &&
          (row.created_by === user?.id ||
            can(role, 'campaigns:approve') ||
            can(role, 'events:manage')),
      ),
    },
    {
      title: 'Upcoming events',
      data: rows.filter((row) => row.kind === 'event' && inPlay(row) && row.starts_on >= today),
    },
    {
      title: 'Fundraising campaigns',
      data: rows.filter((row) => row.kind === 'campaign' && inPlay(row)),
    },
    {
      title: 'Past events',
      data: rows
        .filter(
          (row) =>
            row.kind === 'event' &&
            (row.status === 'completed' || (inPlay(row) && row.starts_on < today)),
        )
        .reverse(),
    },
  ].filter((section) => section.data.length > 0);

  return (
    <Screen>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          can(role, 'campaigns:propose') || can(role, 'events:manage') ? (
            <View style={{ marginBottom: spacing.sm, gap: spacing.sm }}>
              {can(role, 'events:manage') ? (
                <Button label="New event" onPress={() => router.push('/admin/event/new')} />
              ) : null}
              {can(role, 'campaigns:propose') ? (
                <Button
                  label="Start a fundraising campaign"
                  variant="secondary"
                  onPress={() => router.push('/campaign/new')}
                />
              ) : null}
            </View>
          ) : null
        }
        ListEmptyComponent={
          <EmptyState title="No events yet" description="New events will show up here." />
        }
        renderSectionHeader={({ section }) => (
          <View style={{ paddingTop: spacing.md, paddingBottom: spacing.xs }}>
            <Heading>{section.title}</Heading>
          </View>
        )}
        renderItem={({ item }) => {
          const fundBar = fundBarSegments(
            item.stats?.fundRaised ?? 0,
            item.stats?.fundPending ?? 0,
            item.stats?.fundTarget ?? 0,
            item.stats?.fundCarried ?? 0,
          );
          const funded = fundBar.confirmed;
          const waiting = awaitingLine(item.stats?.fundPending ?? 0, currency);
          const inFund = alreadyInFundLine(item.stats?.fundCarried ?? 0, null, currency);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/event/${item.slug}`)}
              style={{ marginBottom: spacing.md }}
            >
              <Card style={{ gap: spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body>
                      {item.emoji} {item.name}
                    </Body>
                    <Caption>
                      {formatDate(item.starts_on)}
                      {item.venue ? ` · ${item.venue}` : ''}
                      {countdown(item.starts_on) ? ` · ${countdown(item.starts_on)}` : ''}
                    </Caption>
                  </View>
                  <Badge
                    label={EVENT_STATUS_LABEL[item.status]}
                    tone={
                      item.status === 'published'
                        ? 'info'
                        : item.status === 'completed'
                          ? 'success'
                          : item.status === 'proposed'
                            ? 'warning'
                            : 'neutral'
                    }
                  />
                </View>

                {item.status !== 'cancelled' && item.status !== 'proposed' ? (
                  <View style={{ gap: 2 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Caption>
                        {formatMoney(item.stats?.fundRaised ?? 0, currency)} of{' '}
                        {formatMoney(
                          fundAsk(
                            item.stats?.fundTarget ?? item.fund_target,
                            item.stats?.fundCarried ?? 0,
                          ),
                          currency,
                        )}
                      </Caption>
                      <Caption>{funded}%</Caption>
                    </View>
                    <Meter
                      percent={funded}
                      pendingPercent={fundBar.pending}
                      tone="success"
                      label="Fund progress"
                    />
                    {/* The headline counts confirmed money only; say what the
                        paler segment is, and that money carried in is there. */}
                    {waiting ? <Caption>{waiting}</Caption> : null}
                    {inFund ? <Caption>{inFund}</Caption> : null}
                  </View>
                ) : item.status === 'proposed' ? (
                  <Caption>Target {formatMoney(item.fund_target, currency)}</Caption>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
