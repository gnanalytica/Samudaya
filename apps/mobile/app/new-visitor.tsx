import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { VISITOR_KIND_LABEL, createVisitorPassSchema } from '@samudaya/core';
import type { Enums } from '@samudaya/supabase';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Body, Button, Caption, Card, Input, Screen } from '../src/components/ui';
import { radius, spacing } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

type Kind = Enums<'visitor_kind'>;

const VALID_FOR: [number, string][] = [
  [2, '2 hours'],
  [6, '6 hours'],
  [12, '12 hours'],
  [24, 'A day'],
];

export default function NewVisitor() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity, membershipId } = useAuth();

  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('guest');
  const [hours, setHours] = useState(6);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passCode, setPassCode] = useState<string | null>(null);

  const submit = async () => {
    if (!activeCommunity || !membershipId) return;

    const now = new Date();
    const parsed = createVisitorPassSchema.safeParse({
      community_id: activeCommunity.id,
      visitor_name: name,
      kind,
      expected_at: now.toISOString(),
      valid_until: new Date(now.getTime() + hours * 3_600_000).toISOString(),
      party_size: 1,
      channel: 'mobile',
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setBusy(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from('visitor_passes')
      .insert({ ...parsed.data, created_by: membershipId })
      .select('pass_code')
      .single();

    setBusy(false);

    if (insertError || !data) {
      setError('Could not create that pass. Please try again.');
      return;
    }

    // Show the code rather than dismissing: it is the whole point of the pass,
    // and the resident usually needs to read it out straight away.
    setPassCode(data.pass_code);
  };

  if (passCode) {
    return (
      <Screen>
        <View style={{ flex: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Card style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl }}>
            <Caption>GATE CODE FOR {name.toUpperCase()}</Caption>
            <Text
              style={{
                fontSize: 44,
                fontWeight: '700',
                letterSpacing: 6,
                color: colors.ink,
              }}
              accessibilityLabel={`Gate code ${passCode.split('').join(' ')}`}
            >
              {passCode}
            </Text>
            <Body muted>Valid for {hours} hours. Ask them to read it out at the gate.</Body>
          </Card>
          <Button label="Done" onPress={() => router.back()} />
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
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={{ gap: spacing.lg }}>
            <Input
              label="Visitor’s name"
              value={name}
              onChangeText={setName}
              placeholder="Ravi Kumar"
              autoCapitalize="words"
            />

            <View style={{ gap: spacing.sm }}>
              <Body>Type</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {(Object.entries(VISITOR_KIND_LABEL) as [Kind, string][]).map(([value, label]) => {
                  const selected = value === kind;
                  return (
                    <Text
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setKind(value)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: 8,
                        borderRadius: radius.pill,
                        overflow: 'hidden',
                        fontSize: 13,
                        backgroundColor: selected ? colors.accent : colors.surfaceSunken,
                        color: selected ? colors.accentInk : colors.inkMuted,
                        fontWeight: selected ? '600' : '400',
                      }}
                    >
                      {label}
                    </Text>
                  );
                })}
              </View>
            </View>

            <View style={{ gap: spacing.sm }}>
              <Body>Pass valid for</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {VALID_FOR.map(([value, label]) => {
                  const selected = value === hours;
                  return (
                    <Text
                      key={value}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setHours(value)}
                      style={{
                        paddingHorizontal: spacing.md,
                        paddingVertical: 8,
                        borderRadius: radius.pill,
                        overflow: 'hidden',
                        fontSize: 13,
                        backgroundColor: selected ? colors.accent : colors.surfaceSunken,
                        color: selected ? colors.accentInk : colors.inkMuted,
                        fontWeight: selected ? '600' : '400',
                      }}
                    >
                      {label}
                    </Text>
                  );
                })}
              </View>
            </View>
          </Card>

          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button label="Create gate pass" onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
