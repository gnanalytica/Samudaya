import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  REQUEST_CATEGORY_LABEL,
  REQUEST_PRIORITY_LABEL,
  createServiceRequestSchema,
} from '@samudaya/core';
import type { Enums } from '@samudaya/supabase';
import { useAuth } from '../src/lib/auth';
import { supabase } from '../src/lib/supabase';
import { Body, Button, Card, Input, Screen } from '../src/components/ui';
import { spacing, radius } from '../src/lib/theme';
import { useTheme } from '../src/lib/use-theme';

type Category = Enums<'request_category'>;
type Priority = Enums<'request_priority'>;

/** A row of tappable chips — a dropdown is awkward on a phone. */
function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (next: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {options.map(([option, label]) => {
        const selected = option === value;
        return (
          <Text
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
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
  );
}

export default function NewRequest() {
  const router = useRouter();
  const { colors } = useTheme();
  const { activeCommunity, membershipId } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('other');
  const [priority, setPriority] = useState<Priority>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!activeCommunity || !membershipId) return;

    // Same schema the web app and the API use, so a request raised here is
    // validated identically wherever it came from.
    const parsed = createServiceRequestSchema.safeParse({
      community_id: activeCommunity.id,
      title,
      description: description || undefined,
      category,
      priority,
      channel: 'mobile',
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the details and try again.');
      return;
    }

    setBusy(true);
    setError(null);

    const { error: insertError } = await supabase
      .from('service_requests')
      .insert({ ...parsed.data, raised_by: membershipId });

    setBusy(false);

    if (insertError) {
      setError('Could not submit that. Please try again.');
      return;
    }

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
          <Card style={{ gap: spacing.lg }}>
            <Input
              label="What’s the problem?"
              value={title}
              onChangeText={setTitle}
              placeholder="Leaking tap in the kitchen"
            />

            <View style={{ gap: spacing.sm }}>
              <Body>Category</Body>
              <ChipRow
                options={Object.entries(REQUEST_CATEGORY_LABEL) as [Category, string][]}
                value={category}
                onChange={setCategory}
              />
            </View>

            <View style={{ gap: spacing.sm }}>
              <Body>Priority</Body>
              <ChipRow
                options={Object.entries(REQUEST_PRIORITY_LABEL) as [Priority, string][]}
                value={priority}
                onChange={setPriority}
              />
            </View>

            <Input
              label="Details"
              value={description}
              onChangeText={setDescription}
              placeholder="Dripping since Monday. Getting worse."
              multiline
              numberOfLines={4}
              style={{ minHeight: 100, textAlignVertical: 'top' }}
            />
          </Card>

          {error ? (
            <Text style={{ color: colors.danger, fontSize: 13 }} accessibilityRole="alert">
              {error}
            </Text>
          ) : null}

          <Button label="Submit request" onPress={submit} loading={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
