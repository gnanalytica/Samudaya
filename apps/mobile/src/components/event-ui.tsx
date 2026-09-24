import { Text, View } from 'react-native';
import { Body, Caption, Card } from './ui';
import { radius, spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/**
 * A thin progress bar, announced to screen readers as a progress indicator.
 *
 * `pendingPercent` draws a second, fainter segment behind the first: on a fund
 * bar that is money reported and not yet confirmed. Same hue at lower opacity
 * rather than a colour of its own — it is the same money one step earlier, and
 * the value announced stays the confirmed figure.
 *
 * Money the committee carried across is not a segment: a fund bar is measured
 * against what residents are asked for, which that money has already been
 * taken off (see fundBarSegments).
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
  tone?: 'accent' | 'success';
  label: string;
}) {
  const { colors } = useTheme();
  const clamped = Math.min(100, Math.max(0, percent));
  const pending = Math.min(100 - clamped, Math.max(0, pendingPercent));
  const fill = tone === 'success' ? colors.success : colors.accent;
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
        <View
          style={{ width: `${pending}%`, height: '100%', backgroundColor: fill, opacity: 0.4 }}
        />
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
