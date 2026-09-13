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
import { useUnreadCount } from '../../src/lib/notifications';
import { spacing } from '../../src/lib/theme';

export default function More() {
  const router = useRouter();
  const { profile, activeCommunity, role, memberships, membershipId, setActiveCommunity, signOut } =
    useAuth();
  const normalized = normalizeRole(role);
  const participant = can(role, 'contribute');
  const unread = useUnreadCount();

  const { data, loading, refreshing, refresh } = useCommunityData(
    `more:${membershipId}`,
    async () => {
      if (!participant) return { contributions: [], registrations: [] };
      const [contributions, registrations] = await Promise.all([
        supabase
          .from('contributions')
          .select(
            'id, amount, status, reference, review_note, receipt_no, paid_at, events(slug, name, emoji)',
          )
          .eq('membership_id', membershipId ?? '')
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
  // Only confirmed payments count; reports waiting for staff show separately.
  const totalGiven = (data?.contributions ?? [])
    .filter((row) => row.status === 'succeeded')
    .reduce((sum, row) => sum + Number(row.amount), 0);

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

        <Card style={{ gap: spacing.xs }}>
          <LinkRow
            label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
            detail="Join requests, payments, bills and new events"
            onPress={() => router.push('/notifications')}
          />
        </Card>

        {can(role, 'events:manage') ? (
          <Card style={{ gap: spacing.xs }}>
            <Heading>{can(role, 'roles:manage') ? 'Committee' : 'Staff'}</Heading>
            <LinkRow
              label="New event"
              detail="Details, budget and activities; save a draft or publish"
              onPress={() => router.push('/admin/event/new')}
            />
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
              detail="Confirm reported UPI payments; record cash; see which flat paid"
              onPress={() => router.push('/admin/payments')}
            />
            {can(role, 'roles:manage') ? (
              <LinkRow
                label="Society UPI ID"
                detail={activeCommunity?.upi_vpa ?? 'Not set — residents can’t pay by UPI yet'}
                onPress={() => router.push('/admin/upi')}
              />
            ) : null}
            <LinkRow
              label="Catalogue"
              detail="Categories, venues, activity types and vendors"
              onPress={() => router.push('/admin/catalogue')}
            />
            <LinkRow
              label="Flats"
              detail={
                can(role, 'roles:manage') ? 'Add, import or remove flats' : 'The society’s flats'
              }
              onPress={() => router.push('/admin/flats')}
            />
            <LinkRow
              label="Share society code"
              detail={`Code ${activeCommunity?.join_code ?? ''} · invite residents on WhatsApp`}
              onPress={() =>
                router.push({ pathname: '/admin/share', params: { for: 'residents' } })
              }
            />
            {can(role, 'roles:manage') ? (
              <>
                <LinkRow
                  label="Society details"
                  detail={activeCommunity?.address ?? 'Add the society’s address'}
                  onPress={() => router.push('/admin/society')}
                />
                <LinkRow
                  label="Setup checklist"
                  detail={activeCommunity?.setup_completed_at ? 'Finished' : 'In progress'}
                  onPress={() => router.push('/admin/setup')}
                />
              </>
            ) : null}
            {can(role, 'campaigns:approve') ? (
              <LinkRow
                label="Committee decisions"
                detail="Proposed campaigns and new suggestions"
                onPress={() => router.push('/admin/queue')}
              />
            ) : null}
            <Caption>To edit an event, open it from Events and tap Manage event.</Caption>
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
                        {contribution.status === 'succeeded'
                          ? receiptRef(contribution.events?.slug, contribution.receipt_no)
                          : contribution.reference
                            ? `UPI ref ${contribution.reference}`
                            : 'Reported'}{' '}
                        · {formatDate(contribution.paid_at.slice(0, 10))}
                      </Caption>
                      <View style={{ flexDirection: 'row' }}>
                        <PaymentStatus status={contribution.status} />
                      </View>
                      {contribution.status === 'failed' && contribution.review_note ? (
                        <Caption>{contribution.review_note}</Caption>
                      ) : null}
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

/** Where a resident's reported payment stands. */
function PaymentStatus({ status }: { status: string }) {
  if (status === 'succeeded') return <Badge label="Confirmed" tone="success" />;
  if (status === 'failed') return <Badge label="Not confirmed" tone="danger" />;
  if (status === 'refunded') return <Badge label="Refunded" />;
  return <Badge label="Waiting for confirmation" tone="warning" />;
}
