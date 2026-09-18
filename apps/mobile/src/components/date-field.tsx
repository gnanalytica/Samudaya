import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { radius, spacing, tapSlop } from '../lib/theme';
import { useTheme } from '../lib/use-theme';
import { Button } from './ui';

/**
 * A date the user picks from the native calendar instead of typing.
 *
 * Values are calendar days as 'YYYY-MM-DD' strings, the same shape the database
 * stores. They are built from the local year, month and day, never through
 * toISOString, which would shift a date picked late in the evening in India to
 * the previous day in UTC.
 */

/** 'YYYY-MM-DD' → a local Date at midnight, or null for anything else. */
export function parseDay(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(
    Number(value.slice(0, 4)),
    Number(value.slice(5, 7)) - 1,
    Number(value.slice(8, 10)),
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A local Date → 'YYYY-MM-DD'. */
export function toDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Today as 'YYYY-MM-DD' on this phone's calendar. */
export const today = () => toDay(new Date());

const describe = (value: string | null) => {
  const date = parseDay(value);
  return date
    ? date.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;
};

export function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  clearable = false,
  placeholder = 'Pick a date',
}: {
  label: string;
  value: string | null;
  onChange: (next: string | null) => void;
  /** 'YYYY-MM-DD'; earlier days can't be picked. */
  minimumDate?: string | null;
  maximumDate?: string | null;
  /** Show a Clear action, for optional dates such as an end date. */
  clearable?: boolean;
  placeholder?: string;
}) {
  const { colors, isDark } = useTheme();
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());

  const min = parseDay(minimumDate) ?? undefined;
  const max = parseDay(maximumDate) ?? undefined;
  // Open on the chosen day, else on the earliest allowed day, else today.
  const initial = parseDay(value) ?? min ?? new Date();

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: initial,
        mode: 'date',
        minimumDate: min,
        maximumDate: max,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(toDay(date));
        },
      });
      return;
    }
    setIosDraft(initial);
    setIosOpen(true);
  };

  const shown = describe(value);

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: '500' }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${shown ?? 'not set'}`}
          accessibilityHint="Opens a calendar"
          onPress={open}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: colors.surfaceRaised,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: radius.sm,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            minHeight: 48,
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: shown ? colors.ink : colors.inkSubtle, fontSize: 15 }}>
            📅 {shown ?? placeholder}
          </Text>
        </Pressable>
        {clearable && value ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Clear ${label}`}
            onPress={() => onChange(null)}
            hitSlop={tapSlop}
          >
            <Text style={{ color: colors.accent, fontSize: 14, fontWeight: '600' }}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosOpen}
          transparent
          animationType="slide"
          onRequestClose={() => setIosOpen(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' }}
            onPress={() => setIosOpen(false)}
            accessibilityLabel="Close calendar"
          />
          <View
            style={{
              backgroundColor: colors.surfaceRaised,
              padding: spacing.lg,
              paddingBottom: spacing.xxl,
              gap: spacing.md,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
            }}
          >
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: '600' }}>{label}</Text>
            <DateTimePicker
              value={iosDraft}
              mode="date"
              display="inline"
              minimumDate={min}
              maximumDate={max}
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor={colors.accent}
              onValueChange={(_event, date) => setIosDraft(date)}
            />
            <Button
              label="Done"
              onPress={() => {
                onChange(toDay(iosDraft));
                setIosOpen(false);
              }}
            />
          </View>
        </Modal>
      ) : null}
    </View>
  );
}
