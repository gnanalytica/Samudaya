import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  REQUEST_CATEGORY_LABEL,
  REQUEST_STATUS_LABEL,
  relativeTime,
  ticketRef,
} from '@samudaya/core';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Loading,
  Screen,
} from '../../src/components/ui';
import { spacing } from '../../src/lib/theme';

export default function Requests() {
  const router = useRouter();

  const { data, loading, refreshing, refresh } = useCommunityData(
    'requests',
    async (communityId) => {
      const { data: requests } = await supabase
        .from('service_requests')
        .select('id, ticket_no, title, category, status, priority, created_at')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(50);
      return requests ?? [];
    },
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const toneFor = (status: string) =>
    status === 'resolved' || status === 'closed'
      ? ('success' as const)
      : status === 'rejected'
        ? ('danger' as const)
        : status === 'open'
          ? ('warning' as const)
          : ('info' as const);

  return (
    <Screen>
      <FlatList
        data={data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <Button label="Raise a request" onPress={() => router.push('/new-request')} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No requests"
            description="Report a leak, a broken light or anything else that needs fixing."
          />
        }
        renderItem={({ item }) => (
          <Card style={{ gap: spacing.xs }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{item.title}</Body>
                <Caption>
                  {ticketRef(item.ticket_no)} · {REQUEST_CATEGORY_LABEL[item.category]} ·{' '}
                  {relativeTime(item.created_at)}
                </Caption>
              </View>
              <Badge label={REQUEST_STATUS_LABEL[item.status]} tone={toneFor(item.status)} />
            </View>
          </Card>
        )}
      />
    </Screen>
  );
}
