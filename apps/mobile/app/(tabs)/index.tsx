import { RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { formatMoney, relativeTime, ticketRef } from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  Heading,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { spacing } from '../../src/lib/theme';

export default function Home() {
  const router = useRouter();
  const { profile, activeCommunity } = useAuth();

  const { data, loading, refreshing, refresh } = useCommunityData('home', async (communityId) => {
    const now = new Date().toISOString();
    const [notices, requests, visitors, invoices] = await Promise.all([
      supabase
        .from('announcements')
        .select('id, title, body, published_at')
        .eq('community_id', communityId)
        .lte('published_at', now)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .order('is_pinned', { ascending: false })
        .order('published_at', { ascending: false })
        .limit(2),
      supabase
        .from('service_requests')
        .select('id, ticket_no, title, status')
        .eq('community_id', communityId)
        .in('status', ['open', 'acknowledged', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(3),
      supabase
        .from('visitor_passes')
        .select('id, visitor_name, pass_code, expected_at')
        .eq('community_id', communityId)
        .in('status', ['expected', 'arrived'])
        .gte('valid_until', now)
        .order('expected_at')
        .limit(3),
      supabase
        .from('invoices')
        .select('id, balance_due')
        .eq('community_id', communityId)
        .in('status', ['issued', 'partly_paid', 'overdue']),
    ]);

    return {
      notices: notices.data ?? [],
      requests: requests.data ?? [],
      visitors: visitors.data ?? [],
      outstanding: (invoices.data ?? []).reduce(
        (sum, invoice) => sum + Number(invoice.balance_due ?? 0),
        0,
      ),
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

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: spacing.xs }}>
          <Title>{firstName ? `Hello, ${firstName}` : 'Home'}</Title>
          <Caption>{activeCommunity?.name ?? ''}</Caption>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Card style={{ flex: 1, gap: spacing.xs }}>
            <Caption>OUTSTANDING</Caption>
            <Heading>
              {formatMoney(data?.outstanding ?? 0, activeCommunity?.currency ?? 'INR')}
            </Heading>
          </Card>
          <Card style={{ flex: 1, gap: spacing.xs }}>
            <Caption>OPEN REQUESTS</Caption>
            <Heading>{String(data?.requests.length ?? 0)}</Heading>
          </Card>
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <View style={{ flex: 1 }}>
            <Button label="Raise a request" onPress={() => router.push('/new-request')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              label="Invite a visitor"
              variant="secondary"
              onPress={() => router.push('/new-visitor')}
            />
          </View>
        </View>

        {data?.notices.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Latest notices</Heading>
            {data.notices.map((notice) => (
              <View key={notice.id} style={{ gap: 2 }}>
                <Body>{notice.title}</Body>
                <Caption>{relativeTime(notice.published_at)}</Caption>
              </View>
            ))}
          </Card>
        ) : null}

        {data?.requests.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Your open requests</Heading>
            {data.requests.map((request) => (
              <View
                key={request.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{request.title}</Body>
                  <Caption>{ticketRef(request.ticket_no)}</Caption>
                </View>
                <Badge label={request.status.replace('_', ' ')} tone="info" />
              </View>
            ))}
          </Card>
        ) : null}

        {data?.visitors.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Expected visitors</Heading>
            {data.visitors.map((visitor) => (
              <View
                key={visitor.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{visitor.visitor_name}</Body>
                  <Caption>{relativeTime(visitor.expected_at)}</Caption>
                </View>
                <Badge label={visitor.pass_code} tone="success" />
              </View>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
