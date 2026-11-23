import React, {
  ComponentProps,
  RefObject,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TrueSheet } from '@lodev09/react-native-true-sheet';
import { useAppSettings, useTheme } from '@hooks/persisted';
import { runWhenIdle } from '@utils/runWhenIdle';
import { getBottomSheetMaxHeight, toBottomSheetDetents } from './layout';

export interface BottomSheetRef {
  present: () => void;
  close: () => void;
}

type ScrollableRef = ComponentProps<typeof TrueSheet>['scrollableRef'];
type ScrollableNode = NonNullable<NonNullable<ScrollableRef>['current']>;

/**
 * Tracks one scroll view per tab and exposes the active tab's as the sheet's
 * `scrollableRef`. Scroll views are kept in state so a lazily mounted tab
 * re-renders the sheet and gets handed to it once it exists.
 */
export const useTabScrollables = (activeKey: string) => {
  const [nodes, setNodes] = useState<Record<string, ScrollableNode | null>>({});
  const [callbacks] = useState(
    () => new Map<string, (node: ScrollableNode | null) => void>(),
  );

  const register = useCallback(
    (key: string) => {
      let callback = callbacks.get(key);
      if (!callback) {
        callback = node =>
          setNodes(prev =>
            prev[key] === node ? prev : { ...prev, [key]: node },
          );
        callbacks.set(key, callback);
      }
      return callback;
    },
    [callbacks],
  );

  const scrollableRef = useMemo(
    () => ({ current: nodes[activeKey] ?? null }),
    [activeKey, nodes],
  );

  return { register, scrollableRef };
};

interface BottomSheetProps {
  bottomSheetRef: RefObject<BottomSheetRef | null>;
  children: React.ReactNode;
  onChange?: (index: number) => void;
  /** Visible content heights in dp; at most three are used. */
  snapPoints: number[];
  /**
   * The scroll view the native sheet hands vertical drags to. Without it the
   * sheet captures every vertical drag, so lists inside it cannot scroll.
   */
  scrollableRef?: ScrollableRef;
}

const DIM_OPACITY = 0.32;
const CORNER_RADIUS = 28;

const SCROLLABLE_OPTIONS = { contentInsetAdjustment: 'never' } as const;

const ignoreRejection = () => {};

const BottomSheet: React.FC<BottomSheetProps> = ({
  bottomSheetRef,
  children,
  onChange,
  snapPoints,
  scrollableRef,
}) => {
  const sheetRef = useRef<TrueSheet>(null);
  const { bottom, top } = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const theme = useTheme();
  const { reduceAppAnimations = false } = useAppSettings();
  const animated = !reduceAppAnimations;

  // Mounting the content up front makes presenting a pure native animation,
  // but doing it during the host screen's first render would slow that down.
  const [preloaded, setPreloaded] = useState(false);
  useEffect(() => runWhenIdle(() => setPreloaded(true), 1000), []);

  useImperativeHandle(
    bottomSheetRef,
    () => ({
      present: () => {
        sheetRef.current?.present(0, animated).catch(ignoreRejection);
      },
      close: () => {
        sheetRef.current?.dismiss(animated).catch(ignoreRejection);
      },
    }),
    [animated],
  );

  const detents = useMemo(
    () =>
      toBottomSheetDetents(
        snapPoints,
        getBottomSheetMaxHeight({ bottom, height, top, width }),
        height,
      ),
    [bottom, height, snapPoints, top, width],
  );

  return (
    <TrueSheet
      ref={sheetRef}
      lazy={!preloaded}
      detents={detents}
      scrollableRef={scrollableRef}
      // The content below pads itself above the navigation bar.
      scrollableOptions={SCROLLABLE_OPTIONS}
      style={styles.flex}
      grabber={false}
      cornerRadius={CORNER_RADIUS}
      backgroundColor={theme.surfaceContainerLow ?? theme.surface}
      dimColor={theme.scrim}
      dimOpacity={DIM_OPACITY}
      onDetentChange={event => onChange?.(event.nativeEvent.index)}
      onDidPresent={event => onChange?.(event.nativeEvent.index)}
      onDidDismiss={() => onChange?.(-1)}
    >
      {/* The sheet's container extends behind the navigation bar. */}
      <View style={[styles.flex, { paddingBottom: bottom }]}>{children}</View>
    </TrueSheet>
  );
};

export default React.memo(BottomSheet);

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
