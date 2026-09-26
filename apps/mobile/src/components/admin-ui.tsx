import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { cardShadow, minTapTarget, radius, spacing } from '../lib/theme';
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
        minHeight: minTapTarget,
        justifyContent: 'center',
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
        minHeight: minTapTarget,
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

/**
 * A row of equal-width segments, for switching between views on one screen
 * (the event page's About / Money / Activities / Vote).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  tone = 'raised',
}: {
  options: readonly { id: T; label: string }[];
  value: T;
  onChange: (next: T) => void;
  /**
   * `raised`: a white segment on a sunken track, for switching views.
   * `ink`: an ink pill on a white bar that floats over the page, for the
   * event page's pinned sections, as the web draws them.
   */
  tone?: 'raised' | 'ink';
}) {
  const { colors, isDark } = useTheme();
  const ink = tone === 'ink';
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: ink ? colors.surfaceRaised : colors.surfaceSunken,
        borderRadius: ink ? radius.lg : radius.md,
        borderColor: ink ? colors.border : 'transparent',
        borderWidth: ink ? StyleSheet.hairlineWidth : 0,
        padding: ink ? 4 : 3,
        gap: 3,
        ...(ink ? cardShadow(isDark) : null),
      }}
    >
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.id)}
            style={({ pressed }) => ({
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 8,
              minHeight: minTapTarget,
              borderRadius: ink ? radius.md : radius.sm,
              backgroundColor: selected ? (ink ? colors.ink : colors.surfaceRaised) : 'transparent',
              opacity: pressed ? 0.8 : 1,
              ...(selected && !ink ? cardShadow(isDark) : null),
            })}
          >
            <Text
              style={{
                color: selected ? (ink ? colors.surface : colors.ink) : colors.inkMuted,
                fontSize: 13,
                fontWeight: selected ? '600' : '500',
              }}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * A collapsible group of fields that most people can skip ("More options").
 * Collapsed content stays mounted so typed values survive closing it.
 */
export function Disclosure({
  label,
  summary,
  defaultOpen = false,
  children,
}: {
  label: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={{ gap: spacing.lg }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          paddingVertical: spacing.xs,
          minHeight: minTapTarget,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ color: colors.accent, fontSize: 15, fontWeight: '600' }}>{label}</Text>
          {summary && !open ? (
            <Text style={{ color: colors.inkSubtle, fontSize: 12 }}>{summary}</Text>
          ) : null}
        </View>
        <Text style={{ color: colors.accent, fontSize: 16 }}>{open ? '▴' : '▾'}</Text>
      </Pressable>
      <View style={{ gap: spacing.lg, display: open ? 'flex' : 'none' }}>{children}</View>
    </View>
  );
}

/** An inline error line in the danger colour. */
export function ErrorText({ message }: { message: string | null }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <Text style={{ color: colors.danger, fontSize: 13 }}>{message}</Text>;
}
