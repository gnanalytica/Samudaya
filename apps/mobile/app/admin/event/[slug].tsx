import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  COPY,
  EVENT_STATUS_LABEL,
  NEW_EDITION,
  SURPLUS_ANSWERS,
  SURPLUS_ANSWER_DETAIL,
  SURPLUS_ANSWER_LABEL,
  can,
  createActivitySchema,
  eventSlug as makeEventSlug,
  formatMoney,
  nextEditionDate,
  nextEditionName,
  type FundRule,
  surplusKindFor,
  type SurplusAnswer,
} from '@samudaya/core';
import { useAuth } from '../../../src/lib/auth';
import { supabase } from '../../../src/lib/supabase';
import { useCommunityData } from '../../../src/lib/use-community-data';
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
} from '../../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../../src/components/admin-ui';
import { CataloguePicker } from '../../../src/components/catalogue-ui';
import {
  ActivityTypeChips,
  DetailsFields,
  validateDetails,
  type Choice,
  type EventDetails,
} from '../../../src/components/event-form';
import { spacing } from '../../../src/lib/theme';

async function loadEvent(communityId: string, slug: string) {
  const { data: event } = await supabase
    .from('events')
    .select(
      'id, community_id, slug, emoji, name, kind, status, starts_on, ends_on, venue, venue_id, event_type_id, organizer, description, expected_attendance, fund_target, suggested_amount, fund_rule, fund_rule_note, created_by',
    )
    .eq('community_id', communityId)
    .eq('slug', slug)
    .maybeSingle();
  if (!event) return null;
  const [budget, activities, openBills, stats, eventType, openEvents, society] = await Promise.all([
    supabase
      .from('budget_lines')
      .select('id, category, category_id, amount, position')
      .eq('event_id', event.id)
      .order('position'),
    supabase
      .from('event_activities')
      .select('id, name, emoji, is_open, activity_participants(count)')
      .eq('event_id', event.id)
      .order('position'),
    supabase
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', event.id)
      .in('status', ['pending', 'changes_requested']),
    supabase.from('event_stats').select('*').eq('event_id', event.id).maybeSingle(),
    event.event_type_id
      ? supabase.from('catalogue_items').select('label').eq('id', event.event_type_id).maybeSingle()
      : Promise.resolve({ data: null }),
    // Events a surplus can be carried into: still open, and not this one.
    supabase
      .from('events')
      .select('id, name, emoji, starts_on')
      .eq('community_id', event.community_id)
      .in('status', ['draft', 'published'])
      .neq('id', event.id)
      .order('starts_on', { ascending: true })
      .limit(100),
    supabase
      .from('society_balance')
      .select('balance')
      .eq('community_id', event.community_id)
      .maybeSingle(),
  ]);
  return {
    event,
    eventTypeLabel: eventType.data?.label ?? null,
    budget: budget.data ?? [],
    activities: (activities.data ?? []).map((activity) => ({
      ...activity,
      registrations:
        (activity.activity_participants as unknown as { count: number }[] | null)?.[0]?.count ?? 0,
    })),
    openBills: openBills.count ?? 0,
    stats: stats.data,
    openEvents: openEvents.data ?? [],
    societyBalance: Number(society.data?.balance ?? 0),
  };
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadEvent>>>;

/** Staff and the committee run an event from the phone. */
export default function ManageEvent() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { role } = useAuth();
  const { data, loading, refreshing, refresh } = useCommunityData(
    `admin:event:${slug}`,
    (communityId) => loadEvent(communityId, String(slug)),
  );

  if (!can(role, 'events:manage')) {
    return (
      <Screen>
        <EmptyState title="Staff and committee only" />
      </Screen>
    );
  }
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
        <EmptyState title="Event not found" />
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        >
          <StatusCard data={data} onChange={refresh} />
          <SurplusCard data={data} onChange={refresh} />
          <BringInBalanceCard data={data} onChange={refresh} />
          <DetailsCard key={`details:${data.event.id}`} data={data} onChange={refresh} />
          <BudgetCard data={data} onChange={refresh} />
          <ActivitiesCard data={data} onChange={refresh} />
          <View style={{ height: spacing.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function useInvalidate(onChange: () => void) {
  const queryClient = useQueryClient();
  return async () => {
    onChange();
    await queryClient.invalidateQueries();
  };
}

function StatusCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const router = useRouter();
  const { role, activeCommunity, membershipId } = useAuth();
  const invalidate = useInvalidate(onChange);
  const { event } = data;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [confirmName, setConfirmName] = useState('');
  const currency = activeCommunity?.currency ?? 'INR';

  const setStatus = async (status: 'draft' | 'published' | 'cancelled') => {
    setBusy(status);
    setError(null);
    const { error: updateError } = await supabase
      .from('events')
      .update({ status })
      .eq('id', event.id)
      .neq('status', 'proposed');
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await invalidate();
  };

  const confirmCancel = () =>
    Alert.alert('Cancel this event?', 'Residents will see it as cancelled.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Cancel event', style: 'destructive', onPress: () => void setStatus('cancelled') },
    ]);

  const close = async () => {
    if (confirmName.trim().toLowerCase() !== event.name.trim().toLowerCase()) {
      setError('Type the event name exactly to close it.');
      return;
    }
    if (data.openBills > 0) {
      setError(
        `${data.openBills} bill${data.openBills === 1 ? '' : 's'} still waiting for a decision. Decide on them before closing.`,
      );
      return;
    }
    setBusy('completed');
    setError(null);
    const stats = data.stats;
    const { error: updateError } = await supabase
      .from('events')
      .update({
        status: 'completed',
        closing_summary: {
          closed_at: new Date().toISOString(),
          closed_by: membershipId,
          raised: stats?.fund_raised ?? 0,
          spent: stats?.spent ?? 0,
          surplus: Number(stats?.fund_raised ?? 0) - Number(stats?.spent ?? 0),
          contributors: stats?.contributors ?? 0,
          participants: stats?.participants ?? 0,
        },
      })
      .eq('id', event.id);
    setBusy(null);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setClosing(false);
    await invalidate();
  };

  const proposed = event.status === 'proposed';
  const finished = event.status === 'completed' || event.status === 'cancelled';

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Title>
            {event.emoji} {event.name}
          </Title>
          <Caption>
            {formatMoney(Number(data.stats?.fund_raised ?? 0), currency)} raised ·{' '}
            {formatMoney(Number(data.stats?.spent ?? 0), currency)} spent ·{' '}
            {data.stats?.contributors ?? 0} households
          </Caption>
        </View>
        <Badge label={EVENT_STATUS_LABEL[event.status]} tone={proposed ? 'warning' : 'neutral'} />
      </View>

      {proposed ? (
        <Caption>A resident’s campaign. The committee approves it from To do.</Caption>
      ) : null}

      {!proposed && !finished ? (
        <View style={{ gap: spacing.sm }}>
          {event.status === 'draft' ? (
            <>
              <Button
                label={COPY.publish}
                onPress={() => void setStatus('published')}
                loading={busy === 'published'}
              />
              <Caption>{COPY.publishHint}</Caption>
            </>
          ) : (
            <Button
              label="Hide from residents"
              variant="secondary"
              onPress={() => void setStatus('draft')}
              loading={busy === 'draft'}
            />
          )}
          <Button
            label="Cancel event"
            variant="secondary"
            onPress={confirmCancel}
            loading={busy === 'cancelled'}
          />
          {can(role, 'events:close') && event.status === 'published' ? (
            closing ? (
              <View style={{ gap: spacing.sm }}>
                <Caption>
                  Closing publishes the final accounts and locks the ledger. Type “{event.name}” to
                  confirm.
                </Caption>
                <Input value={confirmName} onChangeText={setConfirmName} placeholder={event.name} />
                <Button
                  label="Close and publish accounts"
                  onPress={() => void close()}
                  loading={busy === 'completed'}
                />
                <Button label="Not yet" variant="secondary" onPress={() => setClosing(false)} />
              </View>
            ) : data.openBills > 0 ? (
              <Caption>
                {data.openBills} bill{data.openBills === 1 ? '' : 's'} still waiting for a decision;
                close the event once they’re decided.
              </Caption>
            ) : (
              <Button label="Close event" variant="secondary" onPress={() => setClosing(true)} />
            )
          ) : null}
        </View>
      ) : null}

      <ErrorText message={error} />
      <Button
        label="Open the event page"
        variant="secondary"
        onPress={() => router.push(`/event/${event.slug}`)}
      />
    </Card>
  );
}

function DetailsCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity } = useAuth();
  const invalidate = useInvalidate(onChange);
  const { event } = data;
  const [details, setDetails] = useState<EventDetails>(() => ({
    emoji: event.emoji,
    name: event.name,
    eventType: { id: event.event_type_id, label: data.eventTypeLabel },
    venue: { id: event.venue_id, label: event.venue },
    startsOn: event.starts_on,
    endsOn: event.ends_on ?? '',
    description: event.description ?? '',
    organizer: event.organizer ?? '',
    attendance: event.expected_attendance ? String(event.expected_attendance) : '',
    suggestedAmount: event.suggested_amount ? String(event.suggested_amount) : '',
    fundRule: event.fund_rule as FundRule,
    fundRuleNote: event.fund_rule_note ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const locked = event.status === 'completed' || event.status === 'cancelled';

  const save = async () => {
    if (!activeCommunity) return;
    const checked = validateDetails(details, activeCommunity.id, Number(event.fund_target));
    if ('error' in checked) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    const values = checked.values;
    const { error: updateError } = await supabase
      .from('events')
      .update({
        emoji: values.emoji,
        name: values.name,
        starts_on: values.starts_on,
        ends_on: values.ends_on ?? null,
        venue: values.venue ?? null,
        venue_id: details.venue.id,
        event_type_id: details.eventType.id,
        organizer: values.organizer ?? null,
        description: values.description ?? null,
        expected_attendance: values.expected_attendance ?? null,
        suggested_amount: values.suggested_amount ?? null,
        // No fund_rule here: it is fixed when the event is created.
      })
      .eq('id', event.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    await invalidate();
  };

  if (locked) return null;

  return (
    <Card style={{ gap: spacing.lg }}>
      <Heading>Details</Heading>
      <DetailsFields
        details={details}
        onChange={(next) => {
          setDetails(next);
          setSaved(false);
        }}
        fundRuleLocked
      />
      <ErrorText message={error} />
      {saved ? <Caption>Saved.</Caption> : null}
      <Button label="Save details" onPress={() => void save()} loading={busy} />
    </Card>
  );
}

/** Keeps the event's fund target equal to the sum of its budget lines. */
async function syncFundTarget(eventId: string) {
  const { data } = await supabase.from('budget_lines').select('amount').eq('event_id', eventId);
  const total = (data ?? []).reduce((sum, line) => sum + Number(line.amount), 0);
  await supabase.from('events').update({ fund_target: total }).eq('id', eventId);
}

function BudgetCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity } = useAuth();
  const invalidate = useInvalidate(onChange);
  const currency = activeCommunity?.currency ?? 'INR';
  const { event } = data;
  const [category, setCategory] = useState<Choice>({ id: null, label: null });
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = event.status === 'completed' || event.status === 'cancelled';
  const total = data.budget.reduce((sum, line) => sum + Number(line.amount), 0);

  const add = async () => {
    const value = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!category.label) {
      setError('Pick a category.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount.');
      return;
    }
    if (!activeCommunity) return;
    setBusy('add');
    setError(null);
    const { error: insertError } = await supabase.from('budget_lines').insert({
      event_id: event.id,
      community_id: activeCommunity.id,
      category: category.label,
      category_id: category.id,
      amount: value,
      position: data.budget.length,
    });
    if (insertError) {
      setBusy(null);
      setError(insertError.message);
      return;
    }
    await syncFundTarget(event.id);
    setBusy(null);
    setCategory({ id: null, label: null });
    setAmount('');
    await invalidate();
  };

  const remove = async (id: string) => {
    setBusy(id);
    const { error: deleteError } = await supabase.from('budget_lines').delete().eq('id', id);
    if (!deleteError) await syncFundTarget(event.id);
    setBusy(null);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Heading>Budget · {formatMoney(total, currency)}</Heading>
      {data.budget.length ? (
        data.budget.map((line) => (
          <View
            key={line.id}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}
          >
            <View style={{ flex: 1 }}>
              <Body>{line.category}</Body>
              <Caption>{formatMoney(Number(line.amount), currency)}</Caption>
            </View>
            {!locked ? (
              <View style={{ width: 100 }}>
                <Button
                  label="Remove"
                  variant="secondary"
                  onPress={() => void remove(line.id)}
                  loading={busy === line.id}
                />
              </View>
            ) : null}
          </View>
        ))
      ) : (
        <Body muted>No budget lines yet.</Body>
      )}
      {!locked ? (
        <View style={{ gap: spacing.sm }}>
          <CataloguePicker
            kind="budget_category"
            label="Add a line"
            valueId={category.id}
            valueLabel={category.label}
            onChange={setCategory}
          />
          <Input
            label={`Amount (${currency})`}
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="25000"
          />
          <ErrorText message={error} />
          <Button
            label="Add budget line"
            variant="secondary"
            onPress={() => void add()}
            loading={busy === 'add'}
          />
          <Caption>The fund target updates to the sum of the lines.</Caption>
        </View>
      ) : null}
    </Card>
  );
}

function ActivitiesCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity } = useAuth();
  const invalidate = useInvalidate(onChange);
  const { event } = data;
  const [draft, setDraft] = useState<{ typeId: string | null; name: string; emoji: string } | null>(
    null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const locked = event.status === 'completed' || event.status === 'cancelled';

  const add = async () => {
    if (!draft || !activeCommunity) return;
    const parsed = createActivitySchema.safeParse({
      event_id: event.id,
      name: draft.name,
      emoji: draft.emoji || '🎭',
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the activity.');
      return;
    }
    setBusy('add');
    setError(null);
    const { error: insertError } = await supabase.from('event_activities').insert({
      event_id: event.id,
      community_id: activeCommunity.id,
      name: parsed.data.name,
      emoji: parsed.data.emoji,
      activity_type_id: draft.typeId,
      position: data.activities.length,
    });
    setBusy(null);
    if (insertError) {
      setError(
        insertError.code === '23505'
          ? 'This event already has an activity with that name.'
          : insertError.message,
      );
      return;
    }
    setDraft(null);
    await invalidate();
  };

  const update = async (id: string, intent: 'open' | 'close' | 'remove') => {
    setBusy(id);
    setError(null);
    const result =
      intent === 'remove'
        ? await supabase.from('event_activities').delete().eq('id', id)
        : await supabase
            .from('event_activities')
            .update({ is_open: intent === 'open' })
            .eq('id', id);
    setBusy(null);
    if (result.error) {
      setError(result.error.message);
      return;
    }
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <Heading>Activities</Heading>
      {data.activities.length ? (
        data.activities.map((activity) => (
          <View key={activity.id} style={{ gap: spacing.xs }}>
            <Body>
              {activity.emoji} {activity.name}
            </Body>
            <Caption>
              {activity.registrations} registered · {activity.is_open ? 'Open' : 'Closed'}
            </Caption>
            {!locked ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    label={activity.is_open ? 'Close registrations' : 'Reopen'}
                    variant="secondary"
                    onPress={() => void update(activity.id, activity.is_open ? 'close' : 'open')}
                    loading={busy === activity.id}
                  />
                </View>
                {activity.registrations === 0 ? (
                  <View style={{ width: 100 }}>
                    <Button
                      label="Remove"
                      variant="secondary"
                      onPress={() => void update(activity.id, 'remove')}
                    />
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ))
      ) : (
        <Body muted>No activities yet.</Body>
      )}

      {!locked ? (
        draft ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ width: 64 }}>
                <Input
                  label="Emoji"
                  value={draft.emoji}
                  maxLength={8}
                  onChangeText={(emoji) => setDraft({ ...draft, emoji })}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Activity name"
                  value={draft.name}
                  onChangeText={(name) => setDraft({ ...draft, name })}
                />
              </View>
            </View>
            <Button label="Add activity" onPress={() => void add()} loading={busy === 'add'} />
            <Button label="Cancel" variant="secondary" onPress={() => setDraft(null)} />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <Caption>Pick a type to add an activity.</Caption>
            <ActivityTypeChips
              onPick={(item) =>
                setDraft({ typeId: item.id, name: item.label, emoji: item.emoji ?? '🎭' })
              }
            />
          </View>
        )
      ) : null}
      <ErrorText message={error} />
    </Card>
  );
}

/**
 * What happens to the money left in a closed event.
 *
 * Offered after closing rather than as part of it: closing is a speed bump
 * with a typed confirmation, and burying a second decision inside it is how
 * somebody taps the first option to get past the form. It stays on the screen
 * until it is answered, so a committee that wants to talk about it first can
 * come back.
 *
 * No amount field: the figure is what the ledger says, and letting the
 * committee type it would invite a typo into the one number nobody is
 * checking.
 */
function SurplusCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity, role } = useAuth();
  const invalidate = useInvalidate(onChange);
  const currency = activeCommunity?.currency ?? 'INR';
  const { event } = data;
  const surplus = Number(data.stats?.available ?? 0);
  const [answer, setAnswer] = useState<SurplusAnswer>('society_balance');
  // Nothing preselected: a default either creates a draft event nobody asked
  // for, or quietly picks the wrong fund.
  const [target, setTarget] = useState<string>('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closed = event.status === 'completed';
  if (!closed || surplus <= 0 || !can(role, 'events:close')) return null;

  const nextEdition = nextEditionName(event.name, event.starts_on);

  const decide = async () => {
    if (answer === 'another_event' && !target) {
      setError('Choose which event it goes behind.');
      return;
    }
    setBusy(true);
    setError(null);
    const kind = surplusKindFor(answer, target);
    let carryTo: string | undefined =
      kind === 'society_balance' || target === NEW_EDITION ? undefined : target;

    // "Next year's edition" is useless if next year's event has to exist
    // before you can say it, so the draft is made here.
    if (kind === 'next_edition') {
      const { data: created, error: createError } = await supabase
        .from('events')
        .insert({
          community_id: event.community_id,
          slug: makeEventSlug(nextEdition),
          name: nextEdition,
          emoji: event.emoji,
          event_type_id: event.event_type_id,
          venue: event.venue,
          venue_id: event.venue_id,
          organizer: event.organizer,
          starts_on: nextEditionDate(event.starts_on),
          fund_target: 0,
          status: 'draft',
        })
        .select('id')
        .single();
      if (createError) {
        setBusy(false);
        setError(createError.message);
        return;
      }
      carryTo = created.id;
    }

    const { error: rpcError } = await supabase.rpc('allocate_surplus', {
      p_event_id: event.id,
      p_kind: kind,
      p_to_event_id: carryTo,
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Title>{formatMoney(surplus, currency)} left over</Title>
        <Caption>Residents’ money this event didn’t spend. Everyone sees what you decide.</Caption>
      </View>

      <View style={{ gap: spacing.sm }}>
        {SURPLUS_ANSWERS.map((choice) => (
          <Pressable key={choice} onPress={() => setAnswer(choice)}>
            <View style={{ gap: 2 }}>
              <Body>
                {answer === choice ? '◉' : '○'} {SURPLUS_ANSWER_LABEL[choice]}
              </Body>
              <Caption>{SURPLUS_ANSWER_DETAIL[choice]}</Caption>
            </View>
          </Pressable>
        ))}
      </View>

      {/* Which event, asked only once they have said it goes behind one. */}
      {answer === 'another_event' ? (
        <View style={{ gap: spacing.xs }}>
          <Body>Which event</Body>
          <ChipRow>
            {data.openEvents.map((option) => (
              <Chip
                key={option.id}
                label={`${option.emoji} ${option.name}`}
                selected={target === option.id}
                onPress={() => setTarget(option.id)}
              />
            ))}
            <Chip
              label={`+ Create ${nextEdition}`}
              selected={target === NEW_EDITION}
              onPress={() => setTarget(NEW_EDITION)}
            />
          </ChipRow>
        </View>
      ) : null}

      <Input
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Agreed at the October meeting"
      />
      <ErrorText message={error} />
      <Button label="Record the decision" onPress={() => void decide()} loading={busy} />
    </Card>
  );
}

/**
 * The way back out of the society balance, so keeping a surplus is not a
 * one-way door.
 */
function BringInBalanceCard({ data, onChange }: { data: Loaded; onChange: () => void }) {
  const { activeCommunity, role } = useAuth();
  const invalidate = useInvalidate(onChange);
  const currency = activeCommunity?.currency ?? 'INR';
  const { event } = data;
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = event.status === 'draft' || event.status === 'published';
  if (!open || data.societyBalance <= 0 || !can(role, 'events:close')) return null;

  const bringIn = async () => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc('spend_society_balance', {
      p_to_event_id: event.id,
      p_amount: value,
      p_note: note.trim() || undefined,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setAmount('');
    setNote('');
    await invalidate();
  };

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={{ gap: 2 }}>
        <Heading>Bring in society funds</Heading>
        <Caption>Kept for the society: {formatMoney(data.societyBalance, currency)}</Caption>
      </View>
      <Input
        label="Amount (₹)"
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="5000"
      />
      <Input
        label="Note (optional)"
        value={note}
        onChangeText={setNote}
        placeholder="Towards the pandal"
      />
      <ErrorText message={error} />
      <Button label="Put it behind this event" onPress={() => void bringIn()} loading={busy} />
    </Card>
  );
}
