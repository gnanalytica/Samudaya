import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  ROLE_LABEL,
  formatInviteCode,
  isRedeemSuccess,
  normalizeInviteCode,
  redeemMessage,
  type MemberRole,
} from '@samudaya/core';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Body, Button, Caption, Card, Heading, Input, Screen, Title } from '../src/components/ui';
import { spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

type Preview = {
  code: string;
  communityName: string;
  role: MemberRole;
  unitLabel: string | null;
};

/**
 * Invite-code redemption, in two steps: check what the code grants, then
 * confirm. Joining the wrong society needs an admin to undo, so the extra tap
 * is worth it.
 */
export default function Join() {
  const { colors } = useTheme();
  const router = useRouter();
  const { refresh, signOut, memberships } = useAuth();

  const [code, setCode] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async () => {
    const normalized = normalizeInviteCode(code);
    if (normalized.length < 4) {
      setError('Enter the code your community admin gave you.');
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

  const redeem = async () => {
    if (!preview) return;
    setBusy(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('redeem_invite_code', {
      p_code: preview.code,
      p_channel: 'mobile',
    });

    if (rpcError) {
      setBusy(false);
      setError('We could not use that code. Please try again.');
      return;
    }

    const row = data?.[0];
    if (!row?.status || !isRedeemSuccess(row.status)) {
      setBusy(false);
      setError(redeemMessage(row?.status ?? 'not_found'));
      return;
    }

    // Pull the new membership in before navigating, or the tabs would render
    // against an empty community list.
    await refresh();
    setBusy(false);
    router.replace('/(tabs)');
  };

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
          <View style={{ gap: spacing.xs }}>
            <Title>Join your community</Title>
            <Body muted>Enter the invite code from your society admin.</Body>
          </View>

          {preview ? (
            <Card style={{ gap: spacing.md }}>
              <View style={{ gap: spacing.xs }}>
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
                    <Body muted>Unit</Body>
                    <Body>{preview.unitLabel}</Body>
                  </View>
                ) : null}
              </View>
              <Button label={`Join ${preview.communityName}`} onPress={redeem} loading={busy} />
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
                label="Invite code"
                value={code}
                onChangeText={(value) => setCode(formatInviteCode(value))}
                placeholder="ABCD-1234"
                autoCapitalize="characters"
                autoCorrect={false}
                autoComplete="one-time-code"
                style={{ textAlign: 'center', letterSpacing: 3, fontSize: 18 }}
              />
              <Button label="Continue" onPress={check} loading={busy} />
            </Card>
          )}

          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">
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
