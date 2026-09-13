import { useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import {
  can,
  formatMoney,
  paymentProofPath,
  unitLabel,
  upiNote,
  upiPayUri,
  upiReferenceSchema,
} from '@samudaya/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { fetchEventBySlug } from '../src/lib/events';
import { uploadFile, type PickedFile } from '../src/lib/storage';
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
import { ErrorText } from '../src/components/admin-ui';
import { FilePickerField } from '../src/components/file-ui';
import { radius, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

const PRESETS = [1001, 2001, 5001];

/**
 * Pay the society's UPI ID from any UPI app, then report the UPI reference.
 * There is no gateway: the money goes straight to the society's account, and
 * the payment counts in the event total once staff confirm it against the
 * bank statement.
 */
export default function Contribute() {
  const { event: eventSlug } = useLocalSearchParams<{ event: string }>();
  const { activeCommunity, membershipId, role } = useAuth();

  const { data, loading } = useCommunityData(
    `contribute:${eventSlug}:${membershipId}`,
    async (communityId) => {
      const [event, flat] = await Promise.all([
        fetchEventBySlug(communityId, String(eventSlug)),
        supabase
          .from('unit_occupants')
          .select('is_primary, units(id, block, number)')
          .eq('membership_id', membershipId ?? '')
          .is('moved_out_on', null)
          .order('is_primary', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { event, unit: flat.data?.units ?? null };
    },
  );

  // Staff are operators and do not contribute; the database refuses it too.
  if (!can(role, 'contribute')) {
    return (
      <Screen>
        <EmptyState
          title="Staff don’t contribute"
          description="Record a payment a flat made from More → Payments instead."
        />
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

  if (!data?.event || !activeCommunity || !membershipId) {
    return (
      <Screen>
        <EmptyState title="Event not found" />
      </Screen>
    );
  }

  if (!activeCommunity.upi_vpa) {
    return (
      <Screen>
        <EmptyState
          title="Payments aren’t set up yet"
          description="The committee hasn’t added the society’s UPI ID. Please pay the committee directly for now; staff will record it against your flat."
        />
      </Screen>
    );
  }

  return (
    <PayWithUpi
      event={data.event}
      unit={data.unit}
      vpa={activeCommunity.upi_vpa}
      payeeName={activeCommunity.upi_payee_name ?? activeCommunity.name}
    />
  );
}

type Stage = 'amount' | 'report' | 'done';

function PayWithUpi({
  event,
  unit,
  vpa,
  payeeName,
}: {
  event: { id: string; slug: string; name: string };
  unit: { id: string; block: string | null; number: string } | null;
  vpa: string;
  payeeName: string;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();
  const { activeCommunity, membershipId } = useAuth();
  const currency = activeCommunity?.currency ?? 'INR';

  const [stage, setStage] = useState<Stage>('amount');
  const [amount, setAmount] = useState<number | null>(null);
  const [custom, setCustom] = useState('');
  const [reference, setReference] = useState('');
  const [proof, setProof] = useState<PickedFile | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const note = upiNote(unit ? unitLabel(unit) : null, event.name);

  const openUpiApp = async () => {
    if (!amount) return;
    setError(null);
    setNotice(null);
    try {
      await Linking.openURL(upiPayUri({ vpa, payeeName, amount, note }));
      setStage('report');
    } catch {
      // No UPI app handles the link (common on iPhones with no UPI app
      // registered); copy the ID so they can pay by hand.
      await Clipboard.setStringAsync(vpa);
      setNotice(
        `No UPI app opened. We copied the society’s UPI ID (${vpa}); pay ${formatMoney(amount, currency)} from your UPI app with the note “${note}”, then come back here.`,
      );
      setStage('report');
    }
  };

  const submit = async () => {
    if (!amount || !activeCommunity || !membershipId) return;
    const parsed = upiReferenceSchema.safeParse(reference);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Enter the UPI reference.');
      return;
    }
    setBusy(true);
    setError(null);

    let proofPath: string | null = null;
    if (proof) {
      const uploaded = await uploadFile(
        'payment-proofs',
        paymentProofPath(activeCommunity.id, membershipId, proof.name),
        proof,
      );
      if ('error' in uploaded) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      proofPath = uploaded.path;
    }

    const { error: insertError } = await supabase.from('contributions').insert({
      event_id: event.id,
      community_id: activeCommunity.id,
      membership_id: membershipId,
      unit_id: unit?.id ?? null,
      amount,
      method: 'upi',
      reference: parsed.data,
      proof_path: proofPath,
      status: 'pending',
      channel: 'mobile',
    });
    setBusy(false);

    if (insertError) {
      // Don't leave a screenshot behind for a report that never saved.
      if (proofPath) void supabase.storage.from('payment-proofs').remove([proofPath]);
      setError(
        insertError.code === '23505'
          ? 'That UPI reference has already been reported.'
          : 'That did not go through. Please try again.',
      );
      return;
    }

    // Keys embed the member and event (`more:<id>`, `event:<slug>`), so refresh
    // everything rather than guessing prefixes.
    await queryClient.invalidateQueries();
    setStage('done');
  };

  if (stage === 'done') {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
            <Title>Thank you</Title>
            <Text style={{ fontSize: 34, fontWeight: '700', color: colors.success }}>
              {formatMoney(amount ?? 0, currency)}
            </Text>
            <Body muted>Waiting for confirmation</Body>
            <Caption>
              Staff will match your UPI reference with the society’s bank statement. It counts in
              the event total once confirmed; you can follow it under More.
            </Caption>
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>Support {event.name}</Title>
            <Caption>
              Pay the society’s UPI ID directly. Your contribution goes to this event’s fund and
              nowhere else.
            </Caption>
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
                      if (stage !== 'amount') return;
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
              editable={stage === 'amount'}
              onChangeText={(value) => {
                setCustom(value);
                const parsed = Number.parseInt(value, 10);
                setAmount(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
              }}
              keyboardType="number-pad"
              placeholder="Enter an amount"
            />
            <Caption>
              Paying {payeeName} · {vpa}
              {'\n'}Note: {note}
            </Caption>
          </Card>

          {stage === 'amount' ? (
            <>
              <ErrorText message={error} />
              <Button
                label={
                  amount ? `Pay ${formatMoney(amount, currency)} with UPI` : 'Choose an amount'
                }
                onPress={() => void openUpiApp()}
                disabled={!amount}
              />
              <Button
                label="I’ve already paid"
                variant="secondary"
                onPress={() => setStage('report')}
                disabled={!amount}
              />
            </>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <Heading>Tell us you’ve paid</Heading>
              {notice ? <Body muted>{notice}</Body> : null}
              <Input
                label="UPI reference (UTR)"
                value={reference}
                onChangeText={setReference}
                keyboardType="number-pad"
                placeholder="12-digit number from your UPI app"
                autoCapitalize="none"
              />
              <Caption>
                Find it in your UPI app under the payment’s details, often called UPI Ref No or UTR.
              </Caption>
              <FilePickerField
                label="Payment screenshot (optional)"
                file={proof}
                onChange={setProof}
                allowPdf={false}
              />
              <ErrorText message={error} />
              <Button
                label={`Report ${amount ? formatMoney(amount, currency) : 'payment'}`}
                onPress={() => void submit()}
                loading={busy}
                disabled={!amount}
              />
              <Button
                label="Back"
                variant="secondary"
                onPress={() => {
                  setStage('amount');
                  setNotice(null);
                  setError(null);
                }}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
