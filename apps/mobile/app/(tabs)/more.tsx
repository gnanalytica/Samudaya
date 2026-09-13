import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  formatDate,
  formatMoney,
  isAdmin,
  isCommittee,
  receiptRef,
} from '@samudaya/core';
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
import { StatTile } from '../../src/components/event-ui';
import { LinkRow } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

export default function More() {
  const router = useRouter();
  const {
    profile,
    activeCommunity,
    role,
    title,
    approvesSpending,
    memberships,
    membershipId,
    setActiveCommunity,
    signOut,
  } = useAuth();

  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const { data, loading, refreshing, refresh } = useCommunityData('more', async () => {
    const [contributions, activities, volunteering, link] = await Promise.all([
      supabase
        .from('contributions')
        .select('id, amount, receipt_no, paid_at, events(slug, name, emoji)')
        .eq('membership_id', membershipId ?? '')
        .eq('status', 'succeeded')
        .order('paid_at', { ascending: false })
        .limit(20),
      supabase
        .from('activity_participants')
        .select('activity_id, event_activities(name, emoji, events(name))')
        .eq('membership_id', membershipId ?? ''),
      supabase
        .from('event_volunteers')
        .select('role_id, volunteer_roles(name, emoji, events(name))')
        .eq('membership_id', membershipId ?? ''),
      supabase.from('whatsapp_links').select('phone, verified_at').maybeSingle(),
    ]);

    return {
      contributions: contributions.data ?? [],
      activities: activities.data ?? [],
      volunteering: volunteering.data ?? [],
      linkedPhone: link.data?.verified_at ? link.data.phone : null,
    };
  });

  const requestLinkCode = async () => {
    if (!activeCommunity) return;
    setLinking(true);
    const { data: code, error } = await supabase.rpc('create_whatsapp_link_code', {
      p_community_id: activeCommunity.id,
    });
    setLinking(false);
    if (error || !code) {
      Alert.alert('Could not create a code', 'Please try again in a moment.');
      return;
    }
    setLinkCode(code.code);
  };

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const currency = activeCommunity?.currency ?? 'INR';
  const totalGiven = (data?.contributions ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: 2 }}>
          <Title>{profile?.full_name ?? 'You'}</Title>
          <Caption>
            {activeCommunity?.name}
            {title ? ` · ${title}` : ''}
            {role ? ` · ${ROLE_LABEL[role]}` : ''}
            {approvesSpending ? ' · Spending approver' : ''}
          </Caption>
        </View>

        {isCommittee(role) ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>Admin</Heading>
            {isAdmin(role) ? (
              <LinkRow
                label="Approvals"
                detail="Expenses waiting for sign-off and join requests"
                onPress={() => router.push('/admin/approvals')}
              />
            ) : null}
            <LinkRow
              label="Members"
              detail={
                isAdmin(role)
                  ? 'Roles, titles and spending approvers'
                  : 'Who is in the society and their positions'
              }
              onPress={() => router.push('/admin/members')}
            />
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile label="CONTRIBUTED" value={formatMoney(totalGiven, currency)} />
          <StatTile label="PERFORMING" value={String(data?.activities.length ?? 0)} />
          <StatTile label="HELPING" value={String(data?.volunteering.length ?? 0)} />
        </View>

        <Card style={{ gap: spacing.md }}>
          <Heading>Your contributions</Heading>
          {data?.contributions.length ? (
            data.contributions.map((contribution) => (
              <View
                key={contribution.id}
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>
                    {contribution.events?.emoji} {contribution.events?.name}
                  </Body>
                  <Caption>
                    {receiptRef(contribution.events?.slug, contribution.receipt_no)} ·{' '}
                    {formatDate(contribution.paid_at.slice(0, 10))}
                  </Caption>
                </View>
                <Body>{formatMoney(contribution.amount, currency)}</Body>
              </View>
            ))
          ) : (
            <Caption>Nothing yet. Your receipts will show up here.</Caption>
          )}
        </Card>

        {data?.activities.length || data?.volunteering.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>You’re taking part in</Heading>
            {data.activities.map((row) => (
              <View key={row.activity_id} style={{ gap: 2 }}>
                <Body>
                  {row.event_activities?.emoji} {row.event_activities?.name}
                </Body>
                <Caption>{row.event_activities?.events?.name}</Caption>
              </View>
            ))}
            {data.volunteering.map((row) => (
              <View key={row.role_id} style={{ gap: 2 }}>
                <Body>
                  {row.volunteer_roles?.emoji} {row.volunteer_roles?.name}
                </Body>
                <Caption>{row.volunteer_roles?.events?.name} · volunteering</Caption>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <View
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
          >
            <Heading>WhatsApp</Heading>
            <Badge
              label={data?.linkedPhone ? 'Linked' : 'Not linked'}
              tone={data?.linkedPhone ? 'success' : 'neutral'}
            />
          </View>
          {data?.linkedPhone ? (
            <Body muted>
              Linked to {data.linkedPhone}. Send “help” to the bot to see what it can do.
            </Body>
          ) : linkCode ? (
            <View style={{ gap: spacing.xs }}>
              <Caption>SEND THIS TO THE COMMUNITY BOT</Caption>
              <Title>link {linkCode}</Title>
              <Caption>From the number you want to link. Good for 15 minutes.</Caption>
            </View>
          ) : (
            <>
              <Body muted>
                Check the fund, see notices and back an idea without opening the app.
              </Body>
              <Button label="Get a link code" onPress={requestLinkCode} loading={linking} />
            </>
          )}
        </Card>

        {memberships.length > 1 ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Switch community</Heading>
            {memberships.map((membership) => {
              const isActive = membership.community_id === activeCommunity?.id;
              return (
                <Pressable
                  key={membership.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  onPress={() => setActiveCommunity(membership.community_id)}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    paddingVertical: spacing.sm,
                  }}
                >
                  <Body>{membership.communities?.name ?? 'Community'}</Body>
                  {isActive ? <Body muted>Current</Body> : null}
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        <Button
          label="Join another community"
          variant="secondary"
          onPress={() => router.push('/join')}
        />

        <Pressable
          accessibilityRole="button"
          onPress={() =>
            Alert.alert('Sign out?', 'You’ll need to sign in again to use the app.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
            ])
          }
          style={{ paddingVertical: spacing.md, alignItems: 'center' }}
        >
          <Body muted>Sign out</Body>
        </Pressable>
        {/* Clears the tab bar so the last row is never half-hidden behind it. */}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}
