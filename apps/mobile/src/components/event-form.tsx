import { View } from 'react-native';
import {
  FUND_RULES,
  FUND_RULE_LABEL,
  createEventSchema,
  formatMoney,
  type FundRule,
} from '@samudaya/core';
import { spacing } from '../lib/theme';
import { Body, Button, Caption, Input } from './ui';
import { Chip, ChipRow } from './admin-ui';
import { CataloguePicker, useCatalogue } from './catalogue-ui';

/**
 * Pieces shared by creating and editing an event on the phone. Structured
 * fields (event type, venue, budget categories, activity types) come from the
 * society's catalogue; names, descriptions and notes stay free text.
 */

export type Choice = { id: string | null; label: string | null };

export type EventDetails = {
  emoji: string;
  name: string;
  eventType: Choice;
  venue: Choice;
  startsOn: string;
  endsOn: string;
  description: string;
  attendance: string;
  fundRule: FundRule;
  fundRuleNote: string;
};

export const emptyDetails = (): EventDetails => ({
  emoji: '🎉',
  name: '',
  eventType: { id: null, label: null },
  venue: { id: null, label: null },
  startsOn: '',
  endsOn: '',
  description: '',
  attendance: '',
  fundRule: 'general_fund',
  fundRuleNote: '',
});

/**
 * Validates with the same schema the website uses, so a phone and a browser
 * accept exactly the same events. Returns the first problem, or the fields.
 */
export function validateDetails(
  details: EventDetails,
  communityId: string,
  fundTarget: number,
): { error: string } | { values: ReturnType<typeof createEventSchema.parse> } {
  const parsed = createEventSchema.safeParse({
    community_id: communityId,
    slug: 'placeholder-slug',
    emoji: details.emoji || '🎉',
    name: details.name,
    starts_on: details.startsOn.trim(),
    ends_on: details.endsOn.trim() || null,
    venue: details.venue.label ?? undefined,
    description: details.description.trim() || undefined,
    expected_attendance: details.attendance.trim() || undefined,
    fund_target: fundTarget,
    fund_rule: details.fundRule,
    fund_rule_note: details.fundRuleNote.trim() || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? '');
    const friendly: Record<string, string> = {
      starts_on: 'Enter the start date as YYYY-MM-DD.',
      ends_on:
        issue?.message === 'The event cannot end before it starts'
          ? issue.message
          : 'Enter the end date as YYYY-MM-DD, or leave it empty.',
      expected_attendance: 'Expected attendance should be a whole number.',
    };
    return { error: friendly[field] ?? issue?.message ?? 'Check the event details.' };
  }
  return { values: parsed.data };
}

export function DetailsFields({
  details,
  onChange,
}: {
  details: EventDetails;
  onChange: (next: EventDetails) => void;
}) {
  const set = <K extends keyof EventDetails>(key: K, value: EventDetails[K]) =>
    onChange({ ...details, [key]: value });
  const { data: types } = useCatalogue('event_type');

  return (
    <View style={{ gap: spacing.lg }}>
      <Input
        label="Event name"
        value={details.name}
        onChangeText={(value) => set('name', value)}
        placeholder="Deepavali 2026"
      />
      <CataloguePicker
        kind="event_type"
        label="Event type"
        valueId={details.eventType.id}
        valueLabel={details.eventType.label}
        onChange={(next) => {
          // Borrow the type's emoji until someone picks their own.
          const emoji = types?.find((item) => item.id === next.id)?.emoji;
          onChange({ ...details, eventType: next, emoji: emoji ?? details.emoji });
        }}
      />
      <Input
        label="Emoji"
        value={details.emoji}
        onChangeText={(value) => set('emoji', value)}
        maxLength={8}
      />
      <CataloguePicker
        kind="venue"
        label="Venue"
        valueId={details.venue.id}
        valueLabel={details.venue.label}
        onChange={(next) => set('venue', next)}
      />
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Input
            label="Starts on"
            value={details.startsOn}
            onChangeText={(value) => set('startsOn', value)}
            placeholder="2026-11-08"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Input
            label="Ends on (optional)"
            value={details.endsOn}
            onChangeText={(value) => set('endsOn', value)}
            placeholder="2026-11-09"
            autoCapitalize="none"
            keyboardType="numbers-and-punctuation"
          />
        </View>
      </View>
      <Input
        label="Description"
        value={details.description}
        onChangeText={(value) => set('description', value)}
        placeholder="What’s happening, who it’s for, what to bring"
        multiline
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />
      <Input
        label="Expected attendance (optional)"
        value={details.attendance}
        onChangeText={(value) => set('attendance', value.replace(/[^0-9]/g, ''))}
        keyboardType="number-pad"
        placeholder="250"
      />
    </View>
  );
}

export function FundRuleFields({
  details,
  onChange,
}: {
  details: EventDetails;
  onChange: (next: EventDetails) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Body>If money is left over</Body>
      <ChipRow>
        {FUND_RULES.map((rule) => (
          <Chip
            key={rule}
            label={FUND_RULE_LABEL[rule]}
            selected={details.fundRule === rule}
            onPress={() => onChange({ ...details, fundRule: rule })}
          />
        ))}
      </ChipRow>
      <Input
        label="Note for residents (optional)"
        value={details.fundRuleNote}
        onChangeText={(value) => onChange({ ...details, fundRuleNote: value })}
        placeholder="Any surplus goes to Deepavali 2027."
      />
      <Caption>
        Fixed before any money comes in, so nobody decides after seeing the surplus.
      </Caption>
    </View>
  );
}

export type DraftBudgetLine = { key: string; category: Choice; amount: string };

export const newBudgetLine = (): DraftBudgetLine => ({
  key: Math.random().toString(36).slice(2),
  category: { id: null, label: null },
  amount: '',
});

export const lineAmount = (line: { amount: string }) => {
  const value = Number.parseFloat(line.amount.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : 0;
};

export function BudgetLinesEditor({
  lines,
  onChange,
  currency,
}: {
  lines: DraftBudgetLine[];
  onChange: (next: DraftBudgetLine[]) => void;
  currency: string;
}) {
  const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const update = (key: string, patch: Partial<DraftBudgetLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  return (
    <View style={{ gap: spacing.lg }}>
      {lines.map((line, index) => (
        <View key={line.key} style={{ gap: spacing.sm }}>
          <CataloguePicker
            kind="budget_category"
            label={`Line ${index + 1}`}
            valueId={line.category.id}
            valueLabel={line.category.label}
            onChange={(category) => update(line.key, { category })}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input
                label={`Amount (${currency})`}
                value={line.amount}
                onChangeText={(amount) => update(line.key, { amount })}
                keyboardType="decimal-pad"
                placeholder="25000"
              />
            </View>
            <View style={{ width: 110 }}>
              <Button
                label="Remove"
                variant="secondary"
                onPress={() => onChange(lines.filter((item) => item.key !== line.key))}
              />
            </View>
          </View>
        </View>
      ))}
      <Button
        label="+ Add budget line"
        variant="secondary"
        onPress={() => onChange([...lines, newBudgetLine()])}
      />
      <Body>Fund target: {formatMoney(total, currency)}</Body>
      <Caption>The target residents see is the sum of these lines.</Caption>
    </View>
  );
}

/** First problem with a set of budget lines, if any. */
export function budgetProblem(lines: DraftBudgetLine[]): string | null {
  for (const line of lines) {
    const amount = lineAmount(line);
    if (!line.category.label && amount > 0) return 'Pick a category for every budget line.';
    if (line.amount.trim() && amount <= 0) return 'Budget amounts must be more than zero.';
  }
  return null;
}

export type DraftActivity = { key: string; typeId: string | null; name: string; emoji: string };

export function ActivityTypeChips({
  onPick,
}: {
  onPick: (item: { id: string; label: string; emoji: string | null }) => void;
}) {
  const { data: types, loading } = useCatalogue('activity_type');
  if (loading && !types) return <Caption>Loading…</Caption>;
  if (!types?.length)
    return <Caption>No activity types yet. Add them in More → Catalogue.</Caption>;
  return (
    <ChipRow>
      {types.map((item) => (
        <Chip
          key={item.id}
          label={item.emoji ? `${item.emoji} ${item.label}` : item.label}
          onPress={() => onPick(item)}
        />
      ))}
    </ChipRow>
  );
}
