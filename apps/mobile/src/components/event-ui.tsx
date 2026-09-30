import { useEffect, useMemo } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { formatMoney, fundKey, type EventMoney } from '@samudaya/core';
import { Body, Caption, Card } from './ui';
import { useReducedMotion } from './motif';
import { fonts, radius, spacing } from '../lib/theme';
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
  const reduced = useReducedMotion();
  const clamped = Math.min(100, Math.max(0, percent));
  const pending = Math.min(100 - clamped, Math.max(0, pendingPercent));
  const fill = colors[tone];
  // The filled part grows from nothing as the bar arrives, on the native
  // thread; with reduced motion it is simply there.
  const grow = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    if (reduced) {
      grow.setValue(1);
      return;
    }
    const animation = Animated.timing(grow, {
      toValue: 1,
      duration: 1000,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [grow, reduced]);
  const filled = clamped + pending;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: clamped }}
      style={{
        height: 7,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          width: `${filled}%`,
          height: '100%',
          flexDirection: 'row',
          transformOrigin: 'left',
          transform: [{ scaleX: grow }],
        }}
      >
        <View
          style={{
            width: filled ? `${(clamped / filled) * 100}%` : 0,
            height: '100%',
            backgroundColor: fill,
            borderRadius: radius.pill,
          }}
        />
        {pending > 0 ? <Stripes color={fill} style={{ flex: 1, height: '100%' }} /> : null}
      </Animated.View>
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
    <Card style={{ flex: 1, gap: 2, paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
      {/* Not Heading: it fixes its own colour, and a toned tile needs its own. */}
      <Text
        style={{ color, fontFamily: fonts.serif, fontSize: 19, letterSpacing: -0.3 }}
        // A balance is the one figure people read at a glance, and it can be
        // long. Let it shrink rather than wrap mid-number or clip.
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {value}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: colors.inkSubtle,
          fontSize: 10.5,
          fontWeight: '500',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
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

/** The line under the spend bar: what was spent, and what is left or owed. */
export function SpendKey({
  spent,
  balance,
  currency,
}: {
  spent: number;
  balance: number;
  currency: string;
}) {
  const { colors } = useTheme();
  const over = balance < 0;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: 2 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View
          style={{
            width: 12,
            height: 8,
            borderRadius: 2,
            backgroundColor: over ? colors.danger : colors.warning,
          }}
        />
        <Caption>{formatMoney(spent, currency)} spent</Caption>
      </View>
      <Caption tone={over ? 'danger' : undefined}>
        {over
          ? `${formatMoney(-balance, currency)} more than was collected`
          : `${formatMoney(balance, currency)} left`}
      </Caption>
    </View>
  );
}

/** A balance, with a minus sign a person can read when it is below zero. */
export function balanceText(balance: number, currency: string): string {
  return balance < 0 ? `−${formatMoney(-balance, currency)}` : formatMoney(balance, currency);
}

/**
 * The Fund card's three tiles, which add up: what this event collected —
 * carried-in money included, since it is this event's once it arrives — less
 * what it spent, is its balance. Where the collected figure came from is
 * spelt out underneath, because it is the one that surprises people.
 */
export function EventMoneyTiles({ money, currency }: { money: EventMoney; currency: string }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <StatTile label="Collected" value={formatMoney(money.collected, currency)} />
        <StatTile label="Spent" value={formatMoney(money.spent, currency)} />
        <StatTile
          label="Balance"
          value={balanceText(money.balance, currency)}
          tone={money.balance < 0 ? 'danger' : 'success'}
        />
      </View>
      <Caption>
        {money.carriedIn > 0
          ? `Collected is ${formatMoney(money.fromResidents, currency)} from residents and ${formatMoney(money.carriedIn, currency)} carried in. `
          : ''}
        Balance is collected less approved bills
        {money.movedOut > 0 ? `, after ${formatMoney(money.movedOut, currency)} moved on` : ''}.
      </Caption>
    </View>
  );
}

/**
 * What staff and the committee see first on an event: how much of its money
 * is left, so nobody commits to a bill the event cannot pay. Below zero it
 * says somebody paid the difference and is owed it.
 */
export function EventBalanceCard({
  money,
  currency,
  onPayBack,
}: {
  money: EventMoney;
  currency: string;
  /** Where the committee pays an overspend back; absent for staff. */
  onPayBack?: () => void;
}) {
  const { colors } = useTheme();
  const over = money.overBy > 0;
  return (
    <Card style={{ gap: spacing.sm }}>
      <Text
        style={{
          color: colors.gold,
          fontSize: 10.5,
          fontWeight: '600',
          letterSpacing: 1.4,
          textTransform: 'uppercase',
        }}
      >
        {over ? 'Over its fund' : 'Left to spend'}
      </Text>
      <Text
        style={{
          color: over ? colors.danger : colors.ink,
          fontFamily: fonts.serif,
          fontSize: 28,
          letterSpacing: -0.4,
        }}
      >
        {balanceText(money.balance, currency)}
      </Text>
      <Caption>
        {formatMoney(money.spent, currency)} spent of {formatMoney(money.collected, currency)}{' '}
        collected
      </Caption>
      <Meter percent={money.spentPercent} tone={over ? 'danger' : 'warning'} label="Spent" />
      <SpendKey spent={money.spent} balance={money.balance} currency={currency} />
      {over ? (
        <Body muted>
          Somebody paid the difference out of their own pocket.
          {onPayBack ? ' ' : ' The committee pays them back.'}
          {onPayBack ? (
            <Text style={{ color: colors.danger, fontWeight: '600' }} onPress={onPayBack}>
              Pay them back
            </Text>
          ) : null}
        </Body>
      ) : null}
    </Card>
  );
}
