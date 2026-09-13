import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { can, formatMoney, receiptRef } from '@samudaya/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { fetchEventBySlug } from '../src/lib/events';
import { useCommunityData } from '../src/lib/use-community-data';
import {
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
} from '../src/components/ui';
import { radius, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

const PRESETS = [500, 1000, 2000, 5000];
const METHODS = ['upi', 'card', 'netbanking'] as const;

export default function Contribute() {
  const { event: eventSlug } = useLocalSearchParams<{ event: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity, membershipId, role } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);

  const { data: event, loading } = useCommunityData(`contribute:${eventSlug}`, (communityId) =>
    fetchEventBySlug(communityId, String(eventSlug)),
  );

  // Staff are operators and do not contribute; the database refuses it too.
  if (!can(role, 'contribute')) {
    return (
      <Screen>
        <EmptyState
          title="Staff don’t contribute"
          description="Record a payment a flat made from Admin → Payments instead."
        />
      </Screen>
    );
  }

  if (loading && !event) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  const submit = async () => {
    if (!event || !membershipId || !amount || !activeCommunity) return;
    setBusy(true);
    setError(null);

    // This records the contribution. Wiring a payment gateway means inserting
    // it as `pending` and letting the gateway's webhook confirm it.
    const { data, error: insertError } = await supabase
      .from('contributions')
      .insert({
        event_id: event.id,
        community_id: activeCommunity.id,
        membership_id: membershipId,
        amount,
        method,
        status: 'succeeded',
        channel: 'mobile',
      })
      .select('receipt_no')
      .single();

    setBusy(false);

    if (insertError || !data) {
      setError('That did not go through. Please try again.');
      return;
    }
    setReceipt(String(data.receipt_no));
  };

  if (receipt && event) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
            <Title>Thank you</Title>
            <Text style={{ fontSize: 34, fontWeight: '700', color: colors.success }}>
              {formatMoney(amount ?? 0, currency)}
            </Text>
            <Caption>RECEIPT</Caption>
            <Heading>{receiptRef(event.slug, receipt)}</Heading>
            <Body muted>Every rupee shows up in the event ledger.</Body>
          </Card>
          <Button label="Done" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const chip = (selected: boolean) => ({
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.sm,
    overflow: 'hidden' as const,
    fontSize: 15,
    fontWeight: selected ? ('600' as const) : ('400' as const),
    backgroundColor: selected ? colors.accent : colors.surfaceSunken,
    color: selected ? colors.accentInk : colors.inkMuted,
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 2 }}>
          <Title>Support {event?.name ?? 'this event'}</Title>
          <Caption>Your contribution goes to this event’s fund and nowhere else.</Caption>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.sm }}>
            <Body>Amount</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {PRESETS.map((preset) => (
                <Text
                  key={preset}
                  accessibilityRole="button"
                  accessibilityState={{ selected: amount === preset && custom === '' }}
                  onPress={() => {
                    setAmount(preset);
                    setCustom('');
                  }}
                  style={chip(amount === preset && custom === '')}
                >
                  {formatMoney(preset, currency)}
                </Text>
              ))}
            </View>
          </View>

          <Input
            label="Or another amount"
            value={custom}
            onChangeText={(value) => {
              setCustom(value);
              const parsed = Number.parseInt(value, 10);
              setAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
            }}
            keyboardType="number-pad"
            placeholder="Enter an amount"
          />

          <View style={{ gap: spacing.sm }}>
            <Body>Payment method</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {METHODS.map((value) => (
                <Text
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: method === value }}
                  onPress={() => setMethod(value)}
                  style={chip(method === value)}
                >
                  {value === 'upi' ? 'UPI' : value === 'card' ? 'Card' : 'Net banking'}
                </Text>
              ))}
            </View>
          </View>
        </Card>

        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>
            {error}
          </Text>
        ) : null}

        <Button
          label={amount ? `Contribute ${formatMoney(amount, currency)}` : 'Choose an amount'}
          onPress={submit}
          loading={busy}
          disabled={!amount}
        />
      </ScrollView>
    </Screen>
  );
}
