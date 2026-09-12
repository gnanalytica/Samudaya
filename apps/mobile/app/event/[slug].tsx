import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  FUND_RULE_LABEL,
  TASK_STATUS_DOT,
  countdown,
  formatDate,
  formatMoney,
  fundedPercent,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { fetchEventDetail } from '../../src/lib/events';
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
  Title,
} from '../../src/components/ui';
import { KeyValue, Meter, StatTile } from '../../src/components/event-ui';
import { spacing } from '../../src/lib/theme';

export default function EventDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { activeCommunity, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, refreshing, refresh } = useCommunityData(
    `event:${slug}`,
    async (communityId) => fetchEventDetail(communityId, String(slug), membershipId ?? ''),
  );

  if (loading && !data) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <EmptyState title="Event not found" description="It may have been removed." />
      </Screen>
    );
  }

  const { event, stats, tasks, activities, roles, expenses, joinedActivities, joinedRoles } = data;
  const funded = fundedPercent(stats.fundRaised, stats.fundTarget);
  const open = event.status === 'published';

  const toggleActivity = async (activityId: string, joined: boolean) => {
    if (!membershipId) return;
    setBusy(activityId);
    const query = joined
      ? supabase
          .from('activity_participants')
          .delete()
          .eq('activity_id', activityId)
          .eq('membership_id', membershipId)
      : supabase
          .from('activity_participants')
          .upsert(
            { activity_id: activityId, membership_id: membershipId, channel: 'mobile' },
            { onConflict: 'activity_id,membership_id' },
          );
    const { error } = await query;
    setBusy(null);
    if (error) {
      Alert.alert('That did not work', 'Please try again in a moment.');
      return;
    }
    refresh();
  };

  const toggleRole = async (roleId: string, joined: boolean) => {
    if (!membershipId) return;
    setBusy(roleId);
    const query = joined
      ? supabase
          .from('event_volunteers')
          .delete()
          .eq('role_id', roleId)
          .eq('membership_id', membershipId)
      : supabase
          .from('event_volunteers')
          .upsert(
            { role_id: roleId, membership_id: membershipId, channel: 'mobile' },
            { onConflict: 'role_id,membership_id' },
          );
    const { error } = await query;
    setBusy(null);
    if (error) {
      Alert.alert('That did not work', 'Please try again in a moment.');
      return;
    }
    refresh();
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <View style={{ gap: 2 }}>
          <Body>{event.emoji}</Body>
          <Title>{event.name}</Title>
          <Caption>
            {formatDate(event.starts_on)}
            {event.venue ? ` · ${event.venue}` : ''}
            {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
          </Caption>
        </View>

        {event.description ? <Body muted>{event.description}</Body> : null}

        <Card style={{ gap: spacing.md }}>
          <Heading>Fund</Heading>
          <Title>{formatMoney(stats.fundRaised, currency)}</Title>
          <Caption>of {formatMoney(stats.fundTarget, currency)} target</Caption>
          <Meter percent={funded} tone="success" label="Fund progress" />
          <View style={{ gap: spacing.xs }}>
            <KeyValue label="Spent" value={formatMoney(stats.spent, currency)} />
            <KeyValue label="Available" value={formatMoney(stats.available, currency)} />
            <KeyValue label="Contributors" value={String(stats.contributors)} />
          </View>
          {open ? (
            <Button
              label="Contribute"
              onPress={() => router.push(`/contribute?event=${event.slug}`)}
            />
          ) : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <StatTile label="READY" value={`${stats.readiness}%`} />
          <StatTile label="PERFORMING" value={String(stats.participants)} />
          <StatTile label="HELPING" value={String(stats.volunteers)} />
        </View>

        {activities.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Perform</Heading>
            {activities.map((activity) => {
              const joined = joinedActivities.has(activity.id);
              return (
                <View key={activity.id} style={{ gap: spacing.sm }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: spacing.md,
                    }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Body>
                        {activity.emoji} {activity.name}
                      </Body>
                      <Caption>{activity.interested} interested</Caption>
                    </View>
                    {open && activity.is_open ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: joined, busy: busy === activity.id }}
                        onPress={() => toggleActivity(activity.id, joined)}
                        disabled={busy !== null}
                      >
                        <Badge
                          label={joined ? '✓ You’re in' : 'Join'}
                          tone={joined ? 'success' : 'info'}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}

        {roles.length ? (
          <Card style={{ gap: spacing.md }}>
            <Heading>Volunteer</Heading>
            {roles.map((role) => {
              const joined = joinedRoles.has(role.id);
              return (
                <View
                  key={role.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: spacing.md,
                  }}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Body>
                      {role.emoji} {role.name}
                    </Body>
                    <Caption>
                      {role.signedUp} of {role.target_count}
                      {role.stillNeeded > 0 ? ` · ${role.stillNeeded} more needed` : ' · full'}
                    </Caption>
                  </View>
                  {open ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ selected: joined, busy: busy === role.id }}
                      onPress={() => toggleRole(role.id, joined)}
                      disabled={busy !== null}
                    >
                      <Badge
                        label={joined ? '✓ Signed up' : 'Volunteer'}
                        tone={joined ? 'success' : 'info'}
                      />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </Card>
        ) : null}

        {tasks.length ? (
          <Card style={{ gap: spacing.sm }}>
            <Heading>Checklist</Heading>
            <Caption>
              {stats.tasksDone} of {stats.tasksTotal} complete
            </Caption>
            <Meter percent={stats.readiness} label="Event readiness" />
            {tasks.map((task) => (
              <View
                key={task.id}
                style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' }}
              >
                <Body>{TASK_STATUS_DOT[task.status]}</Body>
                <View style={{ flex: 1 }}>
                  <Body muted={task.status === 'done'}>{task.name}</Body>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={{ gap: spacing.md }}>
          <Heading>Where the money went</Heading>
          {expenses.length ? (
            expenses.map((expense) => (
              <View
                key={expense.id}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: spacing.md,
                }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Body>{expense.name}</Body>
                  <Caption>
                    {expense.vendor ?? 'Vendor not recorded'}
                    {expense.bill_url ? ' · 📎 bill attached' : ''}
                  </Caption>
                </View>
                <Body>{formatMoney(expense.amount, currency)}</Body>
              </View>
            ))
          ) : (
            <Caption>Nothing spent yet. Approved expenses appear here with their bills.</Caption>
          )}
        </Card>

        <Card>
          <Caption>🔒 {event.fund_rule_note ?? FUND_RULE_LABEL[event.fund_rule]}</Caption>
        </Card>
      </ScrollView>
    </Screen>
  );
}
