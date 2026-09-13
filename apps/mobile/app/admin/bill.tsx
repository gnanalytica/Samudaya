import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { can, formatMoney } from '@samudaya/core';
import { useAuth } from '../../src/lib/auth';
import { supabase } from '../../src/lib/supabase';
import { useCommunityData } from '../../src/lib/use-community-data';
import {
  Body,
  Button,
  Caption,
  Card,
  EmptyState,
  Input,
  Loading,
  Screen,
  Title,
} from '../../src/components/ui';
import { Chip, ChipRow, ErrorText } from '../../src/components/admin-ui';
import { spacing } from '../../src/lib/theme';

const METHODS = [
  { value: 'upi', label: 'UPI' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'cheque', label: 'Cheque' },
] as const;

type Method = (typeof METHODS)[number]['value'];

/**
 * Add a bill, or correct one that is still waiting or was sent back. A
 * corrected bill goes back into the committee's queue as pending.
 */
export default function BillForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { role } = useAuth();

  const { data, loading } = useCommunityData(`admin:bill:${id ?? 'new'}`, async (communityId) => {
    const [events, existing] = await Promise.all([
      supabase
        .from('events')
        .select('id, name, emoji, status, budget_lines(category)')
        .eq('community_id', communityId)
        .in('status', ['draft', 'published'])
        .order('starts_on', { ascending: true }),
      id
        ? supabase
            .from('expenses')
            .select(
              'id, event_id, name, category, amount, vendor, method, bill_url, spent_on, status',
            )
            .eq('id', id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    return { events: events.data ?? [], existing: existing.data };
  });

  if (!can(role, 'expenses:submit')) {
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

  if (id && !data?.existing) {
    return (
      <Screen>
        <EmptyState title="Bill not found" />
      </Screen>
    );
  }

  return (
    <Form
      key={data?.existing?.id ?? 'new'}
      events={data?.events ?? []}
      existing={data?.existing ?? null}
    />
  );
}

type EventOption = {
  id: string;
  name: string;
  emoji: string;
  budget_lines: { category: string }[];
};

type Existing = {
  id: string;
  event_id: string;
  name: string;
  category: string | null;
  amount: number;
  vendor: string | null;
  method: string;
  bill_url: string | null;
  spent_on: string;
  status: string;
};

function Form({ events, existing }: { events: EventOption[]; existing: Existing | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeCommunity, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const [eventId, setEventId] = useState(existing?.event_id ?? events[0]?.id ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [category, setCategory] = useState(existing?.category ?? '');
  const [amount, setAmount] = useState(existing ? String(existing.amount) : '');
  const [vendor, setVendor] = useState(existing?.vendor ?? '');
  const [method, setMethod] = useState<Method>(
    (METHODS.find((item) => item.value === existing?.method)?.value ?? 'upi') as Method,
  );
  const [spentOn, setSpentOn] = useState(
    existing?.spent_on ?? new Date().toISOString().slice(0, 10),
  );
  const [billRef, setBillRef] = useState(existing?.bill_url ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = events.find((event) => event.id === eventId);
  const categories = [...new Set((selected?.budget_lines ?? []).map((line) => line.category))];

  const save = async () => {
    const value = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!eventId) {
      setError('Pick the event this bill belongs to.');
      return;
    }
    if (name.trim().length < 2) {
      setError('Describe what was bought.');
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the bill amount.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(spentOn)) {
      setError('Enter the bill date as YYYY-MM-DD.');
      return;
    }
    if (!activeCommunity || !membershipId) return;

    setBusy(true);
    setError(null);
    const fields = {
      event_id: eventId,
      name: name.trim(),
      category: category.trim() || null,
      amount: value,
      vendor: vendor.trim() || null,
      method,
      spent_on: spentOn,
      bill_url: billRef.trim() || null,
    };

    const { error: saveError } = existing
      ? await supabase
          .from('expenses')
          .update({ ...fields, status: 'pending' })
          .eq('id', existing.id)
      : await supabase.from('expenses').insert({
          ...fields,
          community_id: activeCommunity.id,
          requested_by: membershipId,
          paid_by: membershipId,
          status: 'pending',
        });
    setBusy(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['admin:bills'] });
    router.back();
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>{existing ? 'Correct a bill' : 'Add a bill'}</Title>
            <Caption>
              {existing?.status === 'changes_requested'
                ? 'Saving sends it back to the committee for approval.'
                : 'The committee approves every bill before it appears in the accounts.'}
            </Caption>
          </View>

          <Card style={{ gap: spacing.lg }}>
            <View style={{ gap: spacing.sm }}>
              <Body>Event</Body>
              {events.length ? (
                <ChipRow>
                  {events.map((event) => (
                    <Chip
                      key={event.id}
                      label={`${event.emoji} ${event.name}`}
                      selected={eventId === event.id}
                      onPress={() => setEventId(event.id)}
                    />
                  ))}
                </ChipRow>
              ) : (
                <Caption>No open events. Create one on the website first.</Caption>
              )}
            </View>
            <Input
              label="What was bought"
              value={name}
              onChangeText={setName}
              placeholder="Pandal and chairs"
            />
            <View style={{ gap: spacing.sm }}>
              <Input
                label="Budget category"
                value={category}
                onChangeText={setCategory}
                placeholder="Decoration"
              />
              {categories.length ? (
                <ChipRow>
                  {categories.map((value) => (
                    <Chip
                      key={value}
                      label={value}
                      selected={category === value}
                      onPress={() => setCategory(value)}
                    />
                  ))}
                </ChipRow>
              ) : null}
            </View>
            <Input
              label={`Amount (${currency})`}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="12000"
            />
            {Number.parseFloat(amount) > 0 ? (
              <Caption>{formatMoney(Number.parseFloat(amount), currency)}</Caption>
            ) : null}
            <Input
              label="Vendor"
              value={vendor}
              onChangeText={setVendor}
              placeholder="Shubh Tent House"
            />
            <View style={{ gap: spacing.sm }}>
              <Body>Paid by</Body>
              <ChipRow>
                {METHODS.map((item) => (
                  <Chip
                    key={item.value}
                    label={item.label}
                    selected={method === item.value}
                    onPress={() => setMethod(item.value)}
                  />
                ))}
              </ChipRow>
            </View>
            <Input
              label="Bill date"
              value={spentOn}
              onChangeText={setSpentOn}
              placeholder="2026-09-12"
              autoCapitalize="none"
            />
            <Input
              label="Bill (invoice number or link)"
              value={billRef}
              onChangeText={setBillRef}
              placeholder="INV-2231 or a Drive link to the photo"
              autoCapitalize="none"
            />
          </Card>

          <ErrorText message={error} />
          <Button
            label={existing ? 'Save and resubmit' : 'Submit for approval'}
            onPress={() => void save()}
            loading={busy}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
