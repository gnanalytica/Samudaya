import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  can,
  formatDate,
  formatMoney,
  normalizeRole,
  receiptRef,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
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
  const { profile, activeCommunity, role, memberships, membershipId, setActiveCommunity, signOut } =
    useAuth();
  const normalized = normalizeRole(role);
  const participant = can(role, 'contribute');

  const { data, loading, refreshing, refresh } = useCommunityData(
    `more:${membershipId}`,
    async () => {
      if (!participant) return { contributions: [], registrations: [] };
      const [contributions, registrations] = await Promise.all([
        supabase
          .from('contributions')
          .select('id, amount, receipt_no, paid_at, events(slug, name, emoji)')
          .eq('membership_id', membershipId ?? '')
          .eq('status', 'succeeded')
          .order('paid_at', { ascending: false })
          .limit(20),
        supabase
          .from('activity_participants')
          .select('id, participant_name, event_activities(name, emoji, events(name))')
          .eq('membership_id', membershipId ?? ''),
      ]);
      return {
        contributions: contributions.data ?? [],
        registrations: registrations.data ?? [],
      };
    },
  );

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
            {normalized ? ` · ${ROLE_LABEL[normalized]}` : ''}
          </Caption>
          {normalized ? <Caption>{ROLE_DESCRIPTION[normalized]}</Caption> : null}
        </View>

        {can(role, 'events:manage') ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>{can(role, 'roles:manage') ? 'Committee' : 'Staff'}</Heading>
            <LinkRow
              label="Join requests"
              detail="Admit new residents"
              onPress={() => router.push('/admin/requests')}
            />
            <LinkRow
              label="Residents"
              detail={
                can(role, 'roles:manage')
                  ? 'Remove residents and assign roles'
                  : 'Everyone in the society; remove residents who have left'
              }
              onPress={() => router.push('/admin/members')}
            />
            <LinkRow
              label="Bills"
              detail={
                can(role, 'expenses:approve')
                  ? 'Approve, reject or send back bills'
                  : 'Upload bills and correct the ones sent back'
              }
              onPress={() => router.push('/admin/bills')}
            />
            <LinkRow
              label="Payments"
              detail="Which flat paid for which event; record cash and UPI"
              onPress={() => router.push('/admin/payments')}
            />
            {can(role, 'campaigns:approve') ? (
              <LinkRow
                label="Committee decisions"
                detail="Proposed campaigns and new suggestions"
                onPress={() => router.push('/admin/queue')}
              />
            ) : null}
            <Caption>Creating and editing events is on the website for now.</Caption>
          </Card>
        ) : null}

        {participant ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile label="CONTRIBUTED" value={formatMoney(totalGiven, currency)} />
              <StatTile label="REGISTRATIONS" value={String(data?.registrations.length ?? 0)} />
            </View>

            <Card style={{ gap: spacing.md }}>
              <Heading>Your contributions</Heading>
              {data?.contributions.length ? (
                data.contributions.map((contribution) => (
                  <View
                    key={contribution.id}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: spacing.md,
                    }}
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

            {data?.registrations.length ? (
              <Card style={{ gap: spacing.md }}>
                <Heading>Registered for</Heading>
                {data.registrations.map((row) => (
                  <View key={row.id} style={{ gap: 2 }}>
                    <Body>
                      {row.event_activities?.emoji} {row.event_activities?.name}
                      {row.participant_name ? ` · ${row.participant_name}` : ''}
                    </Body>
                    <Caption>{row.event_activities?.events?.name}</Caption>
                  </View>
                ))}
              </Card>
            ) : null}
          </>
        ) : null}

        {memberships.length > 1 ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Switch society</Heading>
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
                  <Body>{membership.communities?.name ?? 'Society'}</Body>
                  {isActive ? <Body muted>Current</Body> : null}
                </Pressable>
              );
            })}
          </Card>
        ) : null}

        <Button
          label="Join another society"
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
