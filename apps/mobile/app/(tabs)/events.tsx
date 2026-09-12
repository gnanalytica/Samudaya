import { FlatList, Pressable, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  EVENT_STATUS_LABEL,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { fetchEvents, fetchStats } from '../../src/lib/events';
import { useCommunityData } from '../../src/lib/use-community-data';
import { Badge, Body, Caption, Card, EmptyState, Loading, Screen } from '../../src/components/ui';
import { Meter } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

export default function Events() {
  const router = useRouter();
  const { activeCommunity } = useAuth();
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

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListEmptyComponent={
          <EmptyState
            title="No events yet"
            description="When the committee plans something, it will appear here."
          />
        }
        renderItem={({ item }) => {
          const funded = fundedPercent(item.stats?.fundRaised ?? 0, item.stats?.fundTarget ?? 0);
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/event/${item.slug}`)}
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
                          : 'neutral'
                    }
                  />
                </View>

                {item.status !== 'cancelled' ? (
                  <View style={{ gap: spacing.sm }}>
                    <View style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Caption>Readiness</Caption>
                        <Caption>{item.stats?.readiness ?? 0}%</Caption>
                      </View>
                      <Meter percent={item.stats?.readiness ?? 0} label="Event readiness" />
                    </View>
                    <View style={{ gap: 2 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Caption>
                          {formatMoney(item.stats?.fundRaised ?? 0, currency)} raised
                        </Caption>
                        <Caption>{funded}%</Caption>
                      </View>
                      <Meter percent={funded} tone="success" label="Fund progress" />
                    </View>
                  </View>
                ) : null}
              </Card>
            </Pressable>
          );
        }}
      />
    </Screen>
  );
}
