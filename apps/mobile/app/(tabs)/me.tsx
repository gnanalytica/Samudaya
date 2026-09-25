import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  can,
  correctionNote,
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
import { ViewSwitchCard } from '../../src/components/view-switch';
import { useUnreadCount } from '../../src/lib/notifications';
import { minTapTarget, spacing } from '../../src/lib/theme';

/** Profile, your payments and registrations, notifications, societies, sign out. */
export default function Me() {
  const router = useRouter();
  const { profile, activeCommunity, role, memberships, membershipId, setActiveCommunity, signOut } =
    useAuth();
  const normalized = normalizeRole(role);
  const participant = can(role, 'contribute');
  const unread = useUnreadCount();

  const { data, loading, refreshing, refresh } = useCommunityData(
    `me:${membershipId}`,
    async () => {
      if (!participant) return { contributions: [], registrations: [] };
      const [contributions, registrations] = await Promise.all([
        supabase
          .from('contributions')
          .select(
            'id, amount, reported_amount, status, reference, review_note, receipt_no, paid_at, events(slug, name, emoji)',
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

        <ViewSwitchCard />

        <Card style={{ gap: spacing.xs }}>
          <LinkRow
            label={unread ? `Notifications (${unread} unread)` : 'Notifications'}
            detail="Join requests, payments, bills and new events"
            onPress={() => router.push('/notifications')}
          />
          {/* Everyone's, not just this member's: the tiles below are what you
              gave, this is what the society took in and spent. */}
          <LinkRow
            label="Society money"
            detail="Every rupee in and out, for every event"
            onPress={() => router.push('/money')}
          />
          {/* The screen has always been there and has never turned a resident
              away — /people checks nothing beyond membership. What it lacked
              was a way in. The only two screens that opened it were Manage,
              which residents never see, and Community, which is switched off
              for the pilot, so on a phone a resident could not look up a
              neighbour at all. */}
          <LinkRow
            label="Residents"
            detail="Everyone in the society, by flat"
            onPress={() => router.push('/people')}
          />
          <LinkRow
            label="Ideas"
            detail="Suggest ideas and vote on them"
            onPress={() => router.push('/ideas')}
          />
        </Card>

        {participant ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <StatTile label="CONTRIBUTED" value={formatMoney(totalGiven, currency)} />
              <StatTile label="REGISTRATIONS" value={String(data?.registrations.length ?? 0)} />
            </View>

            <Card style={{ gap: spacing.md }}>
              <Heading>Your payments</Heading>
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
                            ? `UPI transaction ID ${contribution.reference}`
                            : 'Reported'}{' '}
                        · {formatDate(contribution.paid_at.slice(0, 10))}
                      </Caption>
                      <View style={{ flexDirection: 'row' }}>
                        <PaymentStatus status={contribution.status} />
                      </View>
                      {contribution.status === 'failed' && contribution.review_note ? (
                        <Caption>{contribution.review_note}</Caption>
                      ) : null}
                      {/* A figure that moved with no explanation on the row is
                          the app looking like it lost somebody's money. */}
                      {correctionNote(
                        contribution.amount,
                        contribution.reported_amount,
                        currency,
                      ) ? (
                        <Caption>
                          {correctionNote(
                            contribution.amount,
                            contribution.reported_amount,
                            currency,
                          )}
                          {contribution.review_note ? ` · ${contribution.review_note}` : ''}
                        </Caption>
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
                  <View style={{ gap: 1 }}>
                    <Body>{membership.communities?.name ?? 'Society'}</Body>
                    <Caption>{ROLE_LABEL[normalizeRole(membership.role) ?? 'resident']}</Caption>
                  </View>
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

        <Button
          label="Start a new society"
          variant="secondary"
          onPress={() => router.push('/found')}
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

        {/* Both stores require an app with accounts to offer this, and to
            offer it in the app rather than only by email. It sits below Sign
            out because that is where somebody looks for it, and it is a plain
            row rather than a button so it does not compete with the things
            people actually came here to do. */}
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/delete-account')}
          style={{
            paddingVertical: spacing.md,
            alignItems: 'center',
            minHeight: minTapTarget,
            justifyContent: 'center',
          }}
        >
          <Caption>Delete account</Caption>
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
