import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/** A small selectable pill, used for role and title pickers. */
export function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => ({
        borderRadius: radius.pill,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        backgroundColor: selected ? colors.accent : colors.surfaceRaised,
        borderColor: selected ? colors.accent : colors.border,
        borderWidth: StyleSheet.hairlineWidth,
        opacity: disabled ? 0.5 : pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? colors.accentInk : colors.ink,
          fontSize: 13,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>{children}</View>
  );
}

/** A tappable row with a label, optional detail, and a chevron. */
export function LinkRow({
  label,
  detail,
  onPress,
}: {
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: spacing.sm,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '500' }}>{label}</Text>
        {detail ? <Text style={{ color: colors.inkSubtle, fontSize: 12 }}>{detail}</Text> : null}
      </View>
      <Text style={{ color: colors.inkSubtle, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

/** An inline error line in the danger colour. */
export function ErrorText({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <Text style={{ color: colors.danger, fontSize: 13 }}>{message}</Text>;
}
