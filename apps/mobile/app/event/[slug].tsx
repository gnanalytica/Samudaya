import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  COPY,
  EVENT_STATUS_LABEL,
  EVENT_TABS,
  can,
  countdown,
  formatDate,
  formatMoney,
  fundBarSegments,
  type EventTab,
  type FundRule,
} from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { budgetVsSpent, fetchEventDetail } from '../../src/lib/events';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Badge,
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Heading,
  Input,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText, Segmented } from '../../src/components/admin-ui';
import { FUND_RULE_PLAIN } from '../../src/components/event-form';
import { KeyValue, Meter, StatTile } from '../../src/components/event-ui';
import { ViewFileChip } from '../../src/components/file-ui';
import { spacing } from '../../src/lib/theme';

type Detail = NonNullable<Awaited<ReturnType<typeof fetchEventDetail>>>;

export default function EventDetail() {
  const { slug, tab: initialTab } = useLocalSearchParams<{ slug: string; tab?: string }>();
  const [tab, setTab] = useState<EventTab>(
    () => EVENT_TABS.find((item) => item.id === initialTab)?.id ?? 'about',
  );
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId, viewRole: role } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

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

  const { event, stats } = data;
  const fundBar = fundBarSegments(stats.fundRaised, stats.fundPending, stats.fundTarget);
  const funded = fundBar.confirmed;
  const open = event.status === 'published';

  const changed = () => {
    refresh();
    void queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 2 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Body>{event.emoji}</Body>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {event.kind === 'campaign' ? <Badge label="Campaign" tone="info" /> : null}
              <Badge
                label={EVENT_STATUS_LABEL[event.status]}
                tone={event.status === 'proposed' ? 'warning' : 'neutral'}
              />
            </View>
          </View>
          <Title>{event.name}</Title>
          {can(role, 'events:manage') ? (
            <View style={{ flexDirection: 'row', marginTop: spacing.xs }}>
              <Chip
                label="Manage event"
                onPress={() =>
                  router.push({ pathname: '/admin/event/[slug]', params: { slug: event.slug } })
                }
              />
            </View>
          ) : null}
          <Caption>
            {formatDate(event.starts_on)}
            {countdown(event.starts_on) ? ` · ${countdown(event.starts_on)}` : ''}
          </Caption>
        </View>

        <Segmented options={EVENT_TABS} value={tab} onChange={setTab} />

        {tab === 'about' ? (
          <About data={data} currency={currency} onMoney={() => setTab('money')} />
        ) : null}

        {tab === 'money' ? (
          <>
            <Card style={{ gap: spacing.md }}>
              <Heading>Fund</Heading>
              <Title>{formatMoney(stats.fundRaised, currency)}</Title>
              <Caption>
                of {formatMoney(stats.fundTarget || event.fund_target, currency)} target
              </Caption>
              <Meter percent={funded} tone="success" label="Fund progress" />
              <View style={{ gap: spacing.xs }}>
                <KeyValue label="Spent" value={formatMoney(stats.spent, currency)} />
                <KeyValue label="Available" value={formatMoney(stats.available, currency)} />
                <KeyValue label={COPY.households} value={String(stats.contributors)} />
              </View>
              {open && can(role, 'contribute') ? (
                <Button
                  label="Contribute"
                  onPress={() => router.push(`/contribute?event=${event.slug}`)}
                />
              ) : null}
              {can(role, 'payments:view') ? (
                <Button
                  label="Who has paid"
                  variant="secondary"
                  onPress={() => router.push(`/admin/payments?event=${event.slug}`)}
                />
              ) : null}
              <Caption>
                🔒 If money is left over:{' '}
                {event.fund_rule_note ?? FUND_RULE_PLAIN[event.fund_rule as FundRule]}
              </Caption>
            </Card>

            {data.myPayments.length ? <YourPayments data={data} currency={currency} /> : null}

            <Analytics data={data} currency={currency} />

            <BudgetAndSpending data={data} currency={currency} />
          </>
        ) : null}

        {tab === 'activities' ? <Activities data={data} open={open} onChange={changed} /> : null}

        {tab === 'vote' ? <Suggestions data={data} open={open} onChange={changed} /> : null}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </Screen>
  );
}

function About({
  data,
  currency,
  onMoney,
}: {
  data: Detail;
  currency: string;
  onMoney: () => void;
}) {
  const { event, stats } = data;
  const fundBar = fundBarSegments(stats.fundRaised, stats.fundPending, stats.fundTarget);
  const dates =
    event.ends_on && event.ends_on !== event.starts_on
      ? `${formatDate(event.starts_on)} – ${formatDate(event.ends_on)}`
      : formatDate(event.starts_on);

  return (
    <>
      {event.status === 'proposed' ? (
        <Card>
          <Body muted>
            This campaign is waiting for the committee. Residents can contribute once it is
            approved.
          </Body>
        </Card>
      ) : null}

      <Card style={{ gap: spacing.md }}>
        {event.description ? (
          <Body>{event.description}</Body>
        ) : (
          <Body muted>No description yet.</Body>
        )}
        <View style={{ gap: spacing.xs }}>
          <KeyValue label="Date" value={dates} />
          {event.venue ? <KeyValue label="Venue" value={event.venue} /> : null}
          {data.eventType ? <KeyValue label="Type" value={data.eventType} /> : null}
          {event.organizer ? <KeyValue label="Organiser" value={event.organizer} /> : null}
        </View>
      </Card>

      <Pressable
        accessibilityRole="button"
        onPress={onMoney}
        style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
      >
        <Card style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Heading>{COPY.money}</Heading>
            <Caption>See where it went ›</Caption>
          </View>
          <Caption>
            {formatMoney(stats.fundRaised, currency)} raised of{' '}
            {formatMoney(stats.fundTarget || event.fund_target, currency)}
          </Caption>
          <Meter
            percent={fundBar.confirmed}
            pendingPercent={fundBar.pending}
            tone="success"
            label="Fund progress"
          />
          {stats.fundPending > 0 ? (
            <Caption>
              {formatMoney(stats.fundPending, currency)} reported and waiting to be confirmed
              against the bank. It counts once staff match it.
            </Caption>
          ) : null}
        </Card>
      </Pressable>
    </>
  );
}

function YourPayments({ data, currency }: { data: Detail; currency: string }) {
  return (
    <Card style={{ gap: spacing.sm }}>
      <Heading>Your payments</Heading>
      {data.myPayments.map((payment) => (
        <View key={payment.id} style={{ gap: 2 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: spacing.sm,
            }}
          >
            <Caption>
              {formatMoney(payment.amount, currency)}
              {payment.reference ? ` · UPI transaction ID ${payment.reference}` : ''}
            </Caption>
            <Badge
              label={
                payment.status === 'succeeded'
                  ? 'Confirmed'
                  : payment.status === 'failed'
                    ? 'Not confirmed'
                    : 'Waiting for confirmation'
              }
              tone={
                payment.status === 'succeeded'
                  ? 'success'
                  : payment.status === 'failed'
                    ? 'danger'
                    : 'warning'
              }
            />
          </View>
          {payment.status === 'failed' && payment.review_note ? (
            <Caption>{payment.review_note}</Caption>
          ) : null}
        </View>
      ))}
    </Card>
  );
}

function Analytics({ data, currency }: { data: Detail; currency: string }) {
  const { stats, budget, expenses } = data;
  const planned = budget.reduce((sum, line) => sum + Number(line.amount), 0);
  const spentPercent = planned > 0 ? Math.round((stats.spent / planned) * 100) : 0;
  const perContribution = stats.contributors > 0 ? stats.fundRaised / stats.contributors : 0;
  const biggest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];

  return (
    <View style={{ gap: spacing.md }}>
      <Heading>At a glance</Heading>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StatTile label="BUDGET USED" value={planned > 0 ? `${spentPercent}%` : '—'} />
        <StatTile label="PER HOUSEHOLD" value={formatMoney(perContribution, currency)} />
        <StatTile label="BILLS" value={String(expenses.length)} />
      </View>
      {biggest ? (
        <Caption>
          Largest bill: {biggest.name} · {formatMoney(biggest.amount, currency)}
          {biggest.vendor ? ` · ${biggest.vendor}` : ''}
        </Caption>
      ) : null}
    </View>
  );
}

function BudgetAndSpending({ data, currency }: { data: Detail; currency: string }) {
  const rows = budgetVsSpent(data.budget, data.expenses);
  const planned = data.budget.reduce((sum, line) => sum + Number(line.amount), 0);
  const spent = data.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <>
      <Card style={{ gap: spacing.md }}>
        <Heading>Budget vs spent</Heading>
        {rows.length ? (
          <>
            {rows.map((row) => {
              const percent = row.planned > 0 ? Math.round((row.spent / row.planned) * 100) : 100;
              const over = row.planned > 0 && row.spent > row.planned;
              return (
                <View key={row.category} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Body>{row.category}</Body>
                    <Caption>
                      {formatMoney(row.spent, currency)} / {formatMoney(row.planned, currency)}
                    </Caption>
                  </View>
                  <Meter
                    percent={percent}
                    tone={over ? 'accent' : 'success'}
                    label={`${row.category} spending against budget`}
                  />
                  {over ? <Caption>Over budget</Caption> : null}
                  {row.planned === 0 ? <Caption>Not in the budget</Caption> : null}
                </View>
              );
            })}
            <KeyValue
              label="Total"
              value={`${formatMoney(spent, currency)} of ${formatMoney(planned, currency)}`}
            />
          </>
        ) : (
          <Caption>No budget has been set for this event yet.</Caption>
        )}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Heading>Where the money went</Heading>
        {data.expenses.length ? (
          data.expenses.map((expense) => (
            <View
              key={expense.id}
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{expense.name}</Body>
                <Caption>
                  {[expense.category, expense.vendor ?? 'Vendor not recorded']
                    .filter(Boolean)
                    .join(' · ')}
                  {expense.spent_on ? ` · ${formatDate(expense.spent_on)}` : ''}
                </Caption>
                <ViewFileChip bucket="bills" value={expense.bill_url} label="View bill" />
              </View>
              <Body>{formatMoney(expense.amount, currency)}</Body>
            </View>
          ))
        ) : (
          <Caption>Nothing spent yet. Approved bills appear here, itemised.</Caption>
        )}
      </Card>
    </>
  );
}

function Activities({
  data,
  open,
  onChange,
}: {
  data: Detail;
  open: boolean;
  onChange: () => void;
}) {
  const { viewRole: role, membershipId, profile } = useAuth();
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [familyName, setFamilyName] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const mayRegister = open && can(role, 'activities:register');

  if (!data.activities.length) {
    return (
      <Card>
        <EmptyState
          title="No activities yet"
          description="When the organisers add activities, you can register here."
        />
      </Card>
    );
  }

  const register = async (activityId: string, participantName: string | null) => {
    if (!membershipId) return;
    setBusy(activityId);
    const { error } = await supabase.from('activity_participants').insert({
      activity_id: activityId,
      membership_id: membershipId,
      participant_name: participantName,
      channel: 'mobile',
    });
    setBusy(null);
    if (error) {
      Alert.alert(
        'Could not register',
        error.code === '23505' ? 'That person is already registered.' : 'Please try again.',
      );
      return;
    }
    setFamilyName('');
    setAddingFor(null);
    onChange();
  };

  const withdraw = async (registrationId: string) => {
    setBusy(registrationId);
    const { error } = await supabase
      .from('activity_participants')
      .delete()
      .eq('id', registrationId);
    setBusy(null);
    if (error) {
      Alert.alert('Could not remove that registration', 'Please try again.');
      return;
    }
    onChange();
  };

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: 2 }}>
        <Heading>Activities</Heading>
        {mayRegister ? (
          <Caption>Register yourself, and anyone else from your flat by name.</Caption>
        ) : null}
      </View>
      {data.activities.map((activity) => {
        const mine = data.registrations.filter((row) => row.activity_id === activity.id);
        const selfRegistered = mine.some((row) => !row.participant_name);
        return (
          <View key={activity.id} style={{ gap: spacing.sm }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>
                  {activity.emoji} {activity.name}
                </Body>
                {activity.description ? <Caption>{activity.description}</Caption> : null}
                <Caption>
                  {activity.registered} registered
                  {activity.capacity ? ` · ${activity.capacity} places` : ''}
                  {!activity.is_open ? ' · registration closed' : ''}
                </Caption>
              </View>
            </View>

            {mine.length ? (
              <ChipRow>
                {mine.map((row) => (
                  <Chip
                    key={row.id}
                    label={`✓ ${row.participant_name ?? profile?.full_name ?? 'You'}  ✕`}
                    selected
                    disabled={busy !== null || !mayRegister}
                    onPress={() =>
                      Alert.alert('Remove this registration?', undefined, [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Remove',
                          style: 'destructive',
                          onPress: () => void withdraw(row.id),
                        },
                      ])
                    }
                  />
                ))}
              </ChipRow>
            ) : null}

            {mayRegister && activity.is_open ? (
              addingFor === activity.id ? (
                <View style={{ gap: spacing.sm }}>
                  <Input
                    label="Family member’s name"
                    value={familyName}
                    onChangeText={setFamilyName}
                    autoCapitalize="words"
                    placeholder="e.g. Aarav"
                  />
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Cancel"
                        variant="secondary"
                        onPress={() => setAddingFor(null)}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        label="Register"
                        onPress={() => void register(activity.id, familyName.trim())}
                        disabled={familyName.trim().length < 2}
                        loading={busy === activity.id}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <ChipRow>
                  {!selfRegistered ? (
                    <Chip
                      label="Register me"
                      onPress={() => void register(activity.id, null)}
                      disabled={busy !== null}
                    />
                  ) : null}
                  <Chip
                    label="+ Family member"
                    onPress={() => {
                      setFamilyName('');
                      setAddingFor(activity.id);
                    }}
                    disabled={busy !== null}
                  />
                </ChipRow>
              )
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

function Suggestions({
  data,
  open,
  onChange,
}: {
  data: Detail;
  open: boolean;
  onChange: () => void;
}) {
  const { viewRole: role, membershipId, activeCommunity } = useAuth();
  const [kind, setKind] = useState<'activity' | 'idea'>('activity');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const mayVote = can(role, 'vote');
  const maySuggest = open && can(role, 'suggest');
  const voting = data.suggestions.filter((row) => row.status === 'accepted');
  const waiting = data.suggestions.filter(
    (row) =>
      row.status !== 'accepted' &&
      (row.suggested_by === membershipId || can(role, 'events:manage')),
  );

  const submit = async () => {
    if (!membershipId || !activeCommunity) return;
    if (name.trim().length < 3) {
      setError('Give your suggestion a short title.');
      return;
    }
    setBusy('submit');
    setError(null);
    const { error: insertError } = await supabase.from('activity_suggestions').insert({
      community_id: activeCommunity.id,
      event_id: data.event.id,
      kind,
      name: name.trim(),
      description: description.trim() || null,
      suggested_by: membershipId,
      status: 'new',
    });
    setBusy(null);
    if (insertError) {
      setError('That did not go through. Please try again.');
      return;
    }
    setName('');
    setDescription('');
    setSent(true);
    onChange();
  };

  const vote = async (suggestionId: string, support: boolean) => {
    if (!membershipId) return;
    setBusy(suggestionId);
    const { error: voteError } = await supabase
      .from('suggestion_votes')
      .upsert(
        { suggestion_id: suggestionId, membership_id: membershipId, support },
        { onConflict: 'suggestion_id,membership_id' },
      );
    setBusy(null);
    if (voteError) {
      Alert.alert('Your vote did not go through', 'Voting may have closed. Pull down to refresh.');
      return;
    }
    onChange();
  };

  if (!voting.length && !waiting.length && !maySuggest) {
    return (
      <Card>
        <EmptyState
          title="Nothing to vote on yet"
          description="Suggestions the committee opens for voting appear here."
        />
      </Card>
    );
  }

  return (
    <Card style={{ gap: spacing.lg }}>
      <View style={{ gap: 2 }}>
        <Heading>Suggestions</Heading>
        <Caption>
          The committee reviews each suggestion, then residents vote. One vote per person.
        </Caption>
      </View>

      {voting.map((row) => {
        const total = row.tally.support + row.tally.against;
        const percent = total > 0 ? Math.round((row.tally.support / total) * 100) : 0;
        return (
          <View key={row.id} style={{ gap: spacing.sm }}>
            <View
              style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}
            >
              <View style={{ flex: 1, gap: 2 }}>
                <Body>{row.name}</Body>
                {row.description ? <Caption>{row.description}</Caption> : null}
              </View>
              <Badge label={row.kind === 'idea' ? 'Idea' : 'Activity'} />
            </View>
            <Meter percent={percent} tone="success" label={`${row.name}: support`} />
            <Caption>
              {row.tally.support} for · {row.tally.against} against
              {row.tally.mine === null ? '' : ` · you voted ${row.tally.mine ? 'for' : 'against'}`}
            </Caption>
            {mayVote ? (
              <ChipRow>
                <Chip
                  label="👍 For"
                  selected={row.tally.mine === true}
                  onPress={() => void vote(row.id, true)}
                  disabled={busy !== null}
                />
                <Chip
                  label="👎 Against"
                  selected={row.tally.mine === false}
                  onPress={() => void vote(row.id, false)}
                  disabled={busy !== null}
                />
              </ChipRow>
            ) : null}
          </View>
        );
      })}

      {waiting.length ? (
        <View style={{ gap: spacing.xs }}>
          <Caption>WAITING FOR THE COMMITTEE</Caption>
          {waiting.map((row) => (
            <Body key={row.id} muted>
              {row.kind === 'idea' ? '💡' : '🎭'} {row.name}
            </Body>
          ))}
        </View>
      ) : null}

      {maySuggest ? (
        <View style={{ gap: spacing.sm }}>
          <Caption>SUGGEST SOMETHING</Caption>
          <ChipRow>
            <Chip
              label="Activity"
              selected={kind === 'activity'}
              onPress={() => setKind('activity')}
            />
            <Chip label="Idea" selected={kind === 'idea'} onPress={() => setKind('idea')} />
          </ChipRow>
          <Input
            value={name}
            onChangeText={(value) => {
              setName(value);
              setSent(false);
            }}
            placeholder={kind === 'activity' ? 'e.g. Kids’ lantern walk' : 'e.g. Eco-friendly idol'}
          />
          <Input
            value={description}
            onChangeText={setDescription}
            placeholder="A line or two of detail (optional)"
            multiline
          />
          <Button
            label="Send to the committee"
            onPress={() => void submit()}
            loading={busy === 'submit'}
          />
          {sent ? (
            <Caption>Sent. The committee will review it before it goes to a vote.</Caption>
          ) : null}
          <ErrorText message={error} />
        </View>
      ) : null}
    </Card>
  );
}
