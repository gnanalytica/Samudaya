import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { countdown, formatDate, formatMoney, fundedPercent, normalizeStats } from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchEvents, fetchStats, pickNextEvent } from '../../src/lib/events';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
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
import { Meter, StatTile } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

export default function Home() {
  const router = useRouter();
  const { profile, activeCommunity } = useAuth();

  const { data, loading, refreshing, refresh } = useCommunityData('home', async (communityId) => {
    const events = await fetchEvents(communityId);
    const next = pickNextEvent(events);
    const [stats, notices] = await Promise.all([
      next ? fetchStats([next.id]) : Promise.resolve(new Map()),
      supabase
        .from('announcements')
        .select('id, title, body, published_at')
        .eq('community_id', communityId)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(2),
    ]);
    return {
      next: next ?? null,
      stats: next ? (stats.get(next.id) ?? normalizeStats(null)) : normalizeStats(null),
      notices: notices.data ?? [],
    };
  });

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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: 2 }}>
          <Title>{firstName ? `Hello, ${firstName}` : 'Home'}</Title>
          <Caption>{activeCommunity?.name ?? ''}</Caption>
        </View>

        {next ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <View style={{ gap: 2 }}>
                <Body>{next.emoji}</Body>
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

              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Caption>
                    Readiness · {stats.tasksDone}/{stats.tasksTotal} tasks
                  </Caption>
                  <Caption>{stats.readiness}%</Caption>
                </View>
                <Meter percent={stats.readiness} label="Event readiness" />
              </View>

              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label="View event"
                    variant="secondary"
                    onPress={() => router.push(`/event/${next.slug}`)}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    label="Contribute"
                    onPress={() => router.push(`/contribute?event=${next.slug}`)}
                  />
                </View>
              </View>
            </Card>

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile label="PERFORMING" value={String(stats.participants)} />
              <StatTile label="VOLUNTEERING" value={String(stats.volunteers)} />
              <StatTile label="CONTRIBUTED" value={String(stats.contributors)} />
            </View>
          </>
        ) : (
          <Card>
            <EmptyState
              title="Nothing planned yet"
              description="When the committee plans an event, it will show up here."
            />
          </Card>
        )}

        {data?.notices.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Latest notices</Heading>
            {data.notices.map((notice) => (
              <View key={notice.id} style={{ gap: 2 }}>
                <Body>{notice.title}</Body>
                <Caption>{notice.body.slice(0, 120)}</Caption>
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
