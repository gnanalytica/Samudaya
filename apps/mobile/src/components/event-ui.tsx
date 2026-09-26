import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fundKey } from '@samudaya/core';
import { Body, Caption, Card } from './ui';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/**
 * Diagonal stripes in one colour: money residents have reported paying and
 * nobody has confirmed yet. Drawn without an SVG dependency, as thin bars
 * turned 45° inside a clipped box. Striped rather than fainter, because a
 * fainter bar reads as disabled and stripes read as in progress.
 */
export function Stripes({ color, style }: { color: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ overflow: 'hidden', flexDirection: 'row' }, style]}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: 0.3 }]} />
      {Array.from({ length: 48 }, (_, index) => (
        <View
          key={index}
          style={{
            width: 4,
            height: 32,
            marginTop: -12,
            marginRight: 4,
            backgroundColor: color,
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}

/**
 * A thin progress bar, announced to screen readers as a progress indicator.
 *
 * On a fund bar `percent` is what the fund holds and `pendingPercent` is what
 * is still to be confirmed, striped, both as shares of the event's target
 * (fundBarSegments). The value announced stays the confirmed figure.
 */
export function Meter({
  percent,
  pendingPercent = 0,
  tone = 'accent',
  label,
}: {
  percent: number;
  /** Clamped to whatever the bar has left after the confirmed segment. */
  pendingPercent?: number;
  tone?: 'accent' | 'success' | 'danger' | 'warning';
  label: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, percent));
  const pending = Math.min(100 - clamped, Math.max(0, pendingPercent));
  const fill = colors[tone];
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{
        height: 8,
        flexDirection: 'row',
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <View style={{ width: `${clamped}%`, height: '100%', backgroundColor: fill }} />
      {pending > 0 ? (
        <Stripes color={fill} style={{ width: `${pending}%`, height: '100%' }} />
      ) : null}
    </View>
  );
}

/**
 * The key under a fund bar, in place of sentences: a solid swatch for what is
 * confirmed, a striped one for what is still to be confirmed (fundKey).
 */
export function FundKey({
  confirmed,
  pending,
  currency,
}: {
  confirmed: number;
  pending: number;
  currency: string;
}) {
  const { colors } = useTheme();
  const key = fundKey(confirmed, pending, currency);
  const swatch = { width: 12, height: 8, borderRadius: 2 };
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={[swatch, { backgroundColor: colors.success }]} />
        <Caption>{key.confirmed}</Caption>
      </View>
      {key.pending ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Stripes color={colors.success} style={swatch} />
          <Caption>{key.pending}</Caption>
        </View>
      ) : null}
    </View>
  );
}

export function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'success' | 'danger';
}) {
  const { colors } = useTheme();
  const color =
    tone === 'success' ? colors.success : tone === 'danger' ? colors.danger : colors.ink;
  return (
    <Card style={{ flex: 1, gap: 2, paddingVertical: spacing.md, alignItems: 'center' }}>
      {/* Not Heading: it fixes its own colour, and a toned tile needs its own. */}
      <Text
        style={{ color, fontSize: 15, fontWeight: '600' }}
        // A balance is the one figure people read at a glance, and it can be
        // long. Let it shrink rather than wrap mid-number or clip.
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Caption>{label}</Caption>
    </Card>
  );
}

export function Row({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: spacing.md,
      }}
    >
      <View style={{ flex: 1 }}>{left}</View>
      {right}
    </View>
  );
}

export function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
      <Body muted>{label}</Body>
      <Body>{value}</Body>
    </View>
  );
}
