import { useCallback, useRef, useState } from 'react';
import {
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
} from 'react-native';
import { Segmented } from './admin-ui';
import { spacing } from '../lib/theme';
import { useTheme } from '../lib/use-theme';

/**
 * A long screen read top to bottom, with its sections' names pinned above it:
 * a tap scrolls to a section, and the section being read stays lit. As tabs,
 * About was all most residents ever saw; Activities and Money sat behind taps
 * they never made.
 *
 * The bar must be the ScrollView's child at `stickyIndex`, and each section a
 * direct child spreading `sectionProps(id)`, so their offsets are measured in
 * the same content the ScrollView scrolls.
 */
export function useSectionScroll<T extends string>(ids: readonly T[], initial?: string) {
  const scroll = useRef<ScrollView>(null);
  const tops = useRef(new Map<T, number>());
  const barHeight = useRef(0);
  const arrived = useRef(false);
  const [current, setCurrent] = useState<T | undefined>(ids[0]);

  const sectionProps = (id: T) => ({
    onLayout: (event: LayoutChangeEvent) => {
      const y = event.nativeEvent.layout.y;
      tops.current.set(id, y);
      // A link can ask for a section (?tab=activities); go there once, on arrival.
      if (!arrived.current && id === initial) {
        arrived.current = true;
        scroll.current?.scrollTo({ y: Math.max(0, y - barHeight.current), animated: false });
      }
    },
  });

  const jump = useCallback((id: T) => {
    const y = tops.current.get(id);
    if (y === undefined) return;
    setCurrent(id);
    scroll.current?.scrollTo({
      y: Math.max(0, y - barHeight.current - spacing.sm),
      animated: true,
    });
  }, []);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const edge = contentOffset.y + barHeight.current + spacing.md;
      let next = ids[0];
      for (const id of ids) {
        const top = tops.current.get(id);
        if (top !== undefined && top <= edge) next = id;
      }
      // At the very bottom a short last section can never reach the bar.
      if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 2) {
        next = ids[ids.length - 1];
      }
      setCurrent((previous) => (previous === next ? previous : next));
    },
    [ids],
  );

  const onBarLayout = (event: LayoutChangeEvent) => {
    barHeight.current = event.nativeEvent.layout.height;
  };

  return { scroll, current, jump, onScroll, sectionProps, onBarLayout };
}

/** The pinned bar itself: the same pills as a tab strip, lit by scrolling. */
export function SectionBar<T extends string>({
  sections,
  current,
  onJump,
  onLayout,
}: {
  sections: readonly { id: T; label: string }[];
  current: T | undefined;
  onJump: (id: T) => void;
  onLayout: (event: LayoutChangeEvent) => void;
}) {
  const { colors } = useTheme();
  const value = current ?? sections[0]?.id;
  if (value === undefined) return null;
  return (
    <View
      onLayout={onLayout}
      style={{
        backgroundColor: colors.surface,
        paddingVertical: spacing.sm,
        marginVertical: -spacing.sm,
      }}
    >
      <Segmented options={sections} value={value} onChange={onJump} />
    </View>
  );
}
