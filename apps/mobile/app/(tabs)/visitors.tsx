import { FlatList, RefreshControl, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VISITOR_KIND_LABEL, VISITOR_STATUS_LABEL, relativeTime } from '@samudaya/core';
import { supabase } from '../../src/lib/supabase';
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
import { spacing } from '../../src/lib/theme';

export default function Visitors() {
  const router = useRouter();

  const { data, loading, refreshing, refresh } = useCommunityData(
    'visitors',
    async (communityId) => {
      const { data: passes } = await supabase
        .from('visitor_passes')
        .select('id, visitor_name, kind, status, pass_code, expected_at, party_size')
        .eq('community_id', communityId)
        .order('expected_at', { ascending: false })
        .limit(50);
      return passes ?? [];
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
        ListHeaderComponent={
          <Button label="Invite a visitor" onPress={() => router.push('/new-visitor')} />
        }
        ListEmptyComponent={
          <EmptyState
            title="No visitors yet"
            description="Create a pass and your guest gets a code for the gate."
          />
        }
        renderItem={({ item }) => {
          const active = item.status === 'expected' || item.status === 'arrived';
          return (
            <Card style={{ gap: spacing.sm }}>
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
                    {item.visitor_name}
                    {item.party_size > 1 ? ` +${item.party_size - 1}` : ''}
                  </Body>
                  <Caption>
                    {VISITOR_KIND_LABEL[item.kind]} · {relativeTime(item.expected_at)}
                  </Caption>
                </View>
                <Badge
                  label={VISITOR_STATUS_LABEL[item.status]}
                  tone={active ? 'success' : 'neutral'}
                />
              </View>
              {active ? (
                <View style={{ alignItems: 'center', paddingTop: spacing.xs }}>
                  <Caption>GATE CODE</Caption>
                  <Heading>{item.pass_code}</Heading>
                </View>
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}
