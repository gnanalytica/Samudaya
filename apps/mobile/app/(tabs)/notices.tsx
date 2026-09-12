import { FlatList, RefreshControl, View } from 'react-native';
import { relativeTime } from '@samudaya/core';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import { Body, Caption, Card, EmptyState, Heading, Loading, Screen } from '../../src/components/ui';
import { spacing } from '../../src/lib/theme';

export default function Notices() {
  const { data, loading, refreshing, refresh } = useCommunityData(
    'notices',
    async (communityId) => {
      const now = new Date().toISOString();
      const { data: notices } = await supabase
        .from('announcements')
        .select('id, title, body, published_at, is_pinned')
        .eq('community_id', communityId)
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(50);
      return notices ?? [];
    },
  );

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
            title="No notices yet"
            description="Announcements from the committee will show up here."
          />
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.xs }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <Heading>{item.is_pinned ? `📌 ${item.title}` : item.title}</Heading>
            </View>
            <Caption>{relativeTime(item.published_at)}</Caption>
            <Body muted>{item.body}</Body>
          </Card>
        )}
      />
    </Screen>
  );
}
