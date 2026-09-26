import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

export function Screen({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return <View style={[{ flex: 1, backgroundColor: colors.surface }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: spacing.lg,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Title({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: colors.ink, fontSize: 22, fontWeight: '700', letterSpacing: -0.4 }}>
      {children}
    </Text>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <Text style={{ color: colors.ink, fontSize: 15, fontWeight: '600' }}>{children}</Text>;
}

export function Body({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: muted ? colors.inkMuted : colors.ink, fontSize: 14, lineHeight: 20 }}>
      {children}
    </Text>
  );
}

export function Caption({ children, tone }: { children: ReactNode; tone?: 'danger' | 'warning' }) {
  const { colors } = useTheme();
  return (
    <Text style={{ color: tone ? colors[tone] : colors.inkSubtle, fontSize: 12 }}>{children}</Text>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      onPress={inactive ? undefined : onPress}
      style={({ pressed }) => ({
        backgroundColor: isPrimary ? colors.accent : colors.surfaceRaised,
        borderColor: colors.border,
        borderWidth: isPrimary ? 0 : StyleSheet.hairlineWidth,
        borderRadius: radius.sm,
        paddingVertical: 13,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inactive ? 0.55 : pressed ? 0.85 : 1,
        minHeight: 48,
      })}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? colors.accentInk : colors.ink} />
      ) : (
        <Text
          style={{
            color: isPrimary ? colors.accentInk : colors.ink,
            fontWeight: '600',
            fontSize: 15,
          }}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Input(props: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}>{label}</Text>
      ) : null}
      <TextInput
        placeholderTextColor={colors.inkSubtle}
        accessibilityLabel={label}
        style={[
          {
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            color: colors.ink,
            fontSize: 15,
            minHeight: 48,
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const { colors } = useTheme();
  const color =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'danger'
          ? colors.danger
          : tone === 'info'
            ? colors.accent
            : colors.inkMuted;

  return (
    <View
      style={{
        borderRadius: radius.pill,
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: `${color}1A`,
        borderColor: `${color}55`,
        borderWidth: StyleSheet.hairlineWidth,
      }}
    >
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.xs }}>
      <Heading>{title}</Heading>
      {description ? <Body muted>{description}</Body> : null}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
