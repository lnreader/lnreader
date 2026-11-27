import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  I18nManager,
  LayoutChangeEvent,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import type {
  NavigationState,
  Route,
  SceneRendererProps,
  TabDescriptor,
} from 'react-native-tab-view';

type TabBarRendererProps<T extends Route> = SceneRendererProps & {
  navigationState: NavigationState<T>;
  options: Record<string, TabDescriptor<T>> | undefined;
};

interface SheetTabViewProps<T extends Route> {
  navigationState: NavigationState<T>;
  onIndexChange: (index: number) => void;
  renderScene: (props: SceneRendererProps & { route: T }) => ReactNode;
  renderTabBar: (props: TabBarRendererProps<T>) => ReactNode;
  commonOptions?: TabDescriptor<T>;
  /** Mount each tab on its first visit instead of all up front. */
  lazy?: boolean;
  renderLazyPlaceholder?: (props: { route: T }) => ReactNode;
  initialLayout?: { width?: number; height?: number };
  animationEnabled?: boolean;
  /** Swipe horizontally across the content to move to the adjacent tab. */
  swipeEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

const INDICATOR_DURATION = 200;
// Leaves short or diagonal drags to the sheet and its vertical lists.
const SWIPE_ACTIVE_OFFSET = 20;
const SWIPE_FAIL_OFFSET = 15;
const SWIPE_DISTANCE = 64;
const SWIPE_VELOCITY = 500;

/**
 * A tab view for native bottom sheets. react-native-tab-view's pager is a
 * Compose view on Android, and its composition stays bound to the first window
 * the sheet was shown in, so it stops switching pages after the sheet is
 * dismissed once. This keeps every visited tab mounted and toggles visibility,
 * and switches tabs on a horizontal swipe instead of a draggable pager.
 */
function SheetTabView<T extends Route>({
  navigationState,
  onIndexChange,
  renderScene,
  renderTabBar,
  commonOptions,
  lazy = false,
  renderLazyPlaceholder,
  initialLayout,
  animationEnabled = true,
  swipeEnabled = true,
  style,
}: SheetTabViewProps<T>) {
  const { index, routes } = navigationState;
  const [layout, setLayout] = useState({
    width: 0,
    height: 0,
    ...initialLayout,
  });
  const [visited, setVisited] = useState<ReadonlySet<string>>(
    () => new Set([routes[index].key]),
  );
  const [progress] = useState(() => new Animated.Value(index));
  const position = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
        extrapolate: 'extend',
      }),
    [progress],
  );

  useEffect(() => {
    if (animationEnabled) {
      Animated.timing(progress, {
        toValue: index,
        duration: INDICATOR_DURATION,
        useNativeDriver: true,
      }).start();
    } else {
      progress.setValue(index);
    }
  }, [animationEnabled, index, progress]);

  const jumpTo = useCallback(
    (key: string) => {
      const nextIndex = routes.findIndex(route => route.key === key);
      if (nextIndex === -1) {
        return;
      }
      setVisited(prev => (prev.has(key) ? prev : new Set(prev).add(key)));
      if (nextIndex !== index) {
        onIndexChange(nextIndex);
      }
    },
    [index, onIndexChange, routes],
  );

  const swipe = useMemo(
    () =>
      Gesture.Pan()
        .enabled(swipeEnabled && routes.length > 1)
        .activeOffsetX([-SWIPE_ACTIVE_OFFSET, SWIPE_ACTIVE_OFFSET])
        .failOffsetY([-SWIPE_FAIL_OFFSET, SWIPE_FAIL_OFFSET])
        .runOnJS(true)
        .withTestId('sheet-tab-swipe')
        .onEnd(({ translationX, velocityX }) => {
          const towardsStart =
            translationX > SWIPE_DISTANCE || velocityX > SWIPE_VELOCITY;
          const towardsEnd =
            translationX < -SWIPE_DISTANCE || velocityX < -SWIPE_VELOCITY;
          if (towardsStart === towardsEnd) {
            return;
          }
          const step = (towardsEnd ? 1 : -1) * (I18nManager.isRTL ? -1 : 1);
          const next = routes[index + step];
          if (next) {
            jumpTo(next.key);
          }
        }),
    [index, jumpTo, routes, swipeEnabled],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { height, width } = event.nativeEvent.layout;
    setLayout(prev =>
      prev.width === width && prev.height === height ? prev : { height, width },
    );
  }, []);

  const options = useMemo(
    () =>
      commonOptions
        ? Object.fromEntries(routes.map(route => [route.key, commonOptions]))
        : undefined,
    [commonOptions, routes],
  );

  const sceneProps = { layout, position, jumpTo };

  return (
    <View onLayout={handleLayout} style={[styles.container, style]}>
      {renderTabBar({ ...sceneProps, navigationState, options })}
      <GestureDetector gesture={swipe}>
        <View style={styles.scenes}>
          {routes.map((route, i) => {
            const focused = i === index;
            const mounted = !lazy || focused || visited.has(route.key);
            return (
              <View
                key={route.key}
                accessibilityElementsHidden={!focused}
                importantForAccessibility={
                  focused ? 'auto' : 'no-hide-descendants'
                }
                style={[styles.scene, !focused && styles.hidden]}
              >
                {mounted
                  ? renderScene({ ...sceneProps, route })
                  : renderLazyPlaceholder?.({ route })}
              </View>
            );
          })}
        </View>
      </GestureDetector>
    </View>
  );
}

export default SheetTabView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  hidden: {
    display: 'none',
  },
  scene: {
    ...StyleSheet.absoluteFill,
  },
  scenes: {
    flex: 1,
  },
});
