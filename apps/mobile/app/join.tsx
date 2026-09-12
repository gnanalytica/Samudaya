import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  formatInviteCode,
  isRedeemSuccess,
  joinMessage,
  normalizeJoinCode,
  redeemMessage,
  unitLabel,
  type MemberRole,
} from '@samudaya/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Body, Button, Caption, Card, Heading, Input, Screen, Title } from '../src/components/ui';
import { radius, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

type Unit = { id: string; block: string | null; number: string };

/**
 * Two ways in, matching the web app.
 *
 * Society ID: ask to join, an admin approves. Knowing the ID alone gets nobody
 * in, which is why it can be printed on a notice board.
 *
 * Invite code: already approved, so it lets the resident straight in.
 */
export default function Join() {
  const router = useRouter();
  const { colors } = useTheme();
  const { refresh, signOut, memberships } = useAuth();

  const [mode, setMode] = useState<'society' | 'invite'>('society');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Society ID path
  const [found, setFound] = useState<{ id: string; name: string; code: string } | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitId, setUnitId] = useState<string>('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState<string | null>(null);

  // Invite path
  const [preview, setPreview] = useState<{
    code: string;
    communityName: string;
    role: MemberRole;
    unitLabel: string | null;
  } | null>(null);

  const lookUpSociety = async () => {
    const normalized = normalizeJoinCode(code);
    if (normalized.length < 4) {
      setError('Enter the Society ID your admin gave you.');
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('request_to_join', {
      p_join_code: normalized,
      p_name: 'Resident',
    });
    setBusy(false);

    if (rpcError) {
      setError('We could not check that ID. Please try again.');
      return;
    }

    const row = data?.[0];
    if (!row?.status) {
      setError(joinMessage('not_found'));
      return;
    }
    if (row.status === 'already_member') {
      await refresh();
      router.replace('/(tabs)');
      return;
    }
    if (row.status !== 'pending') {
      setError(joinMessage(row.status));
      return;
    }

    const { data: unitRows } = await supabase
      .from('units')
      .select('id, block, number')
      .eq('community_id', row.community_id ?? '')
      .order('block', { nullsFirst: true })
      .order('number');

    setFound({
      id: row.community_id ?? '',
      name: row.community_name ?? 'this community',
      code: normalized,
    });
    setUnits(unitRows ?? []);
  };

  const sendRequest = async () => {
    if (!found) return;
    if (name.trim().length < 2) {
      setError('Tell us your name.');
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('request_to_join', {
      p_join_code: found.code,
      p_unit_id: unitId || undefined,
      p_name: name.trim(),
      p_phone: phone.trim() || undefined,
    });
    setBusy(false);

    if (rpcError || !data?.[0]?.status) {
      setError('We could not send that request. Please try again.');
      return;
    }
    if (data[0].status !== 'pending') {
      setError(joinMessage(data[0].status ?? 'not_found'));
      return;
    }

    await supabase.auth.updateUser({ data: { full_name: name.trim() } });
    setSubmitted(found.name);
  };

  const checkInvite = async () => {
    const normalized = normalizeJoinCode(code);
    if (normalized.length < 4) {
      setError('Enter the code your admin gave you.');
      return;
    }
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('preview_invite_code', {
      p_code: normalized,
    });
    setBusy(false);

    if (rpcError) {
      setError('We could not check that code. Please try again.');
      return;
    }
    const row = data?.[0];
    if (!row?.status || row.status !== 'ok') {
      setError(redeemMessage(row?.status ?? 'not_found'));
      return;
    }
    setPreview({
      code: normalized,
      communityName: row.community_name ?? 'this community',
      role: (row.role ?? 'resident') as MemberRole,
      unitLabel: row.unit_label,
    });
  };

  const redeemInvite = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('redeem_invite_code', {
      p_code: preview.code,
      p_channel: 'mobile',
    });

    if (rpcError || !data?.[0]?.status || !isRedeemSuccess(data[0].status)) {
      setBusy(false);
      setError(redeemMessage(data?.[0]?.status ?? 'not_found'));
      return;
    }

    // Pull the new membership in before navigating, or the tabs would render
    // against an empty community list.
    await refresh();
    setBusy(false);
    router.replace('/(tabs)');
  };

  const tab = (selected: boolean) => ({
    flex: 1,
    textAlign: 'center' as const,
    paddingVertical: 10,
    borderRadius: radius.sm,
    overflow: 'hidden' as const,
    fontSize: 14,
    fontWeight: selected ? ('600' as const) : ('400' as const),
    backgroundColor: selected ? colors.surfaceSunken : 'transparent',
    color: selected ? colors.ink : colors.inkMuted,
  });

  if (submitted) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
            <Title>Request sent</Title>
            <Body muted>
              Your request to join {submitted} is with the society admin. You’ll get in as soon as
              they approve it.
            </Body>
          </Card>
          {memberships.length > 0 ? (
            <Button
              label="Back to my community"
              variant="secondary"
              onPress={() => router.replace('/(tabs)')}
            />
          ) : (
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
          )}
        </View>
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
          contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: 2 }}>
            <Title>Join your community</Title>
            <Body muted>Use the Society ID your admin shared, or an invite code.</Body>
          </View>

          {!found && !preview ? (
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                gap: 4,
                padding: 4,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceRaised,
              }}
            >
              <Text
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'society' }}
                onPress={() => {
                  setMode('society');
                  setError(null);
                }}
                style={tab(mode === 'society')}
              >
                Society ID
              </Text>
              <Text
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === 'invite' }}
                onPress={() => {
                  setMode('invite');
                  setError(null);
                }}
                style={tab(mode === 'invite')}
              >
                Invite code
              </Text>
            </View>
          ) : null}

          {found ? (
            <Card style={{ gap: spacing.lg }}>
              <View style={{ gap: 2 }}>
                <Caption>JOINING</Caption>
                <Heading>{found.name}</Heading>
              </View>

              <Input label="Your name" value={name} onChangeText={setName} autoCapitalize="words" />

              <View style={{ gap: spacing.sm }}>
                <Body>Your flat</Body>
                {units.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                    {units.slice(0, 40).map((unit) => {
                      const selected = unitId === unit.id;
                      return (
                        <Text
                          key={unit.id}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          onPress={() => setUnitId(selected ? '' : unit.id)}
                          style={{
                            paddingHorizontal: spacing.md,
                            paddingVertical: 8,
                            borderRadius: radius.pill,
                            overflow: 'hidden',
                            fontSize: 13,
                            backgroundColor: selected ? colors.accent : colors.surfaceSunken,
                            color: selected ? colors.accentInk : colors.inkMuted,
                          }}
                        >
                          {unitLabel(unit)}
                        </Text>
                      );
                    })}
                  </View>
                ) : (
                  <Caption>
                    This society hasn’t added its flats yet. You can still ask to join.
                  </Caption>
                )}
              </View>

              <Input
                label="Phone"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                placeholder="9876543210"
              />

              <Button label="Ask to join" onPress={sendRequest} loading={busy} />
            </Card>
          ) : preview ? (
            <Card style={{ gap: spacing.md }}>
              <View style={{ gap: 2 }}>
                <Caption>YOU’RE JOINING</Caption>
                <Heading>{preview.communityName}</Heading>
              </View>
              <View style={{ gap: spacing.xs }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Body muted>Your role</Body>
                  <Body>{ROLE_LABEL[preview.role]}</Body>
                </View>
                {preview.unitLabel ? (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Body muted>Flat</Body>
                    <Body>{preview.unitLabel}</Body>
                  </View>
                ) : null}
              </View>
              <Button
                label={`Join ${preview.communityName}`}
                onPress={redeemInvite}
                loading={busy}
              />
              <Button
                label="Use a different code"
                variant="secondary"
                onPress={() => {
                  setPreview(null);
                  setCode('');
                }}
                disabled={busy}
              />
            </Card>
          ) : (
            <Card style={{ gap: spacing.md }}>
              <Input
                label={mode === 'society' ? 'Society ID' : 'Invite code'}
                value={code}
                onChangeText={(value) =>
                  setCode(mode === 'society' ? value.toUpperCase() : formatInviteCode(value))
                }
                placeholder={mode === 'society' ? 'MHR4827' : 'ABCD-1234'}
                autoCapitalize="characters"
                autoCorrect={false}
                style={{ textAlign: 'center', letterSpacing: 3, fontSize: 18 }}
              />
              <Button
                label="Continue"
                onPress={mode === 'society' ? lookUpSociety : checkInvite}
                loading={busy}
              />
              <Caption>
                {mode === 'society'
                  ? 'A Society ID only lets you ask. Your admin approves who gets in.'
                  : 'An invite code is already approved, so it lets you in immediately.'}
              </Caption>
            </Card>
          )}

          {error ? (
            <Text accessibilityRole="alert" style={{ color: colors.danger, fontSize: 13 }}>
              {error}
            </Text>
          ) : null}

          {memberships.length > 0 ? (
            <Button
              label="Back to my community"
              variant="secondary"
              onPress={() => router.replace('/(tabs)')}
            />
          ) : (
            <Button label="Sign out" variant="secondary" onPress={() => void signOut()} />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
