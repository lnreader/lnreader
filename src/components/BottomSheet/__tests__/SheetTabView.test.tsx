import '../../__tests__/mocks';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@test-utils';
import { State } from 'react-native-gesture-handler';
import {
  fireGestureHandler,
  getByGestureTestId,
} from 'react-native-gesture-handler/jest-utils';

import SheetTabView from '../SheetTabView';

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({}),
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };
  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

const routes = [
  { key: 'filter', title: 'Filter' },
  { key: 'sort', title: 'Sort' },
  { key: 'display', title: 'Display' },
];

const mountedScenes: string[] = [];

const Harness = ({
  initialIndex = 0,
  lazy,
  swipeEnabled,
}: {
  initialIndex?: number;
  lazy?: boolean;
  swipeEnabled?: boolean;
}) => {
  const [index, setIndex] = useState(initialIndex);
  return (
    <SheetTabView
      lazy={lazy}
      swipeEnabled={swipeEnabled}
      navigationState={{ index, routes }}
      onIndexChange={setIndex}
      renderTabBar={({ jumpTo }) => (
        <View>
          {routes.map(route => (
            <Pressable key={route.key} onPress={() => jumpTo(route.key)}>
              <Text>{`tab-${route.title}`}</Text>
            </Pressable>
          ))}
        </View>
      )}
      renderScene={({ route }) => <Scene name={route.title} />}
    />
  );
};

const Scene = ({ name }: { name: string }) => {
  const [mounted] = useState(() => {
    mountedScenes.push(name);
    return true;
  });
  return mounted ? <Text testID={`scene-${name}`}>{name}</Text> : null;
};

describe('SheetTabView', () => {
  beforeEach(() => {
    mountedScenes.length = 0;
  });

  it('switches to the tapped tab', () => {
    render(<Harness />);

    expect(screen.getByTestId('scene-Filter')).toBeTruthy();

    fireEvent.press(screen.getByText('tab-Sort'));
    expect(screen.getByTestId('scene-Sort')).toBeTruthy();
    expect(screen.queryByTestId('scene-Filter')).toBeNull();

    fireEvent.press(screen.getByText('tab-Display'));
    expect(screen.getByTestId('scene-Display')).toBeTruthy();
    expect(screen.queryByTestId('scene-Sort')).toBeNull();
  });

  it('mounts lazy tabs on first visit and keeps them mounted', () => {
    render(<Harness lazy />);

    expect(mountedScenes).toEqual(['Filter']);

    fireEvent.press(screen.getByText('tab-Sort'));
    fireEvent.press(screen.getByText('tab-Filter'));

    expect(mountedScenes).toEqual(['Filter', 'Sort']);
    expect(
      screen.getByTestId('scene-Sort', { includeHiddenElements: true }),
    ).toBeTruthy();
  });

  const swipe = (translationX: number) =>
    act(() => {
      fireGestureHandler(getByGestureTestId('sheet-tab-swipe'), [
        { state: State.BEGAN, translationX: 0, velocityX: 0 },
        { state: State.ACTIVE, translationX: translationX / 2, velocityX: 0 },
        { state: State.END, translationX, velocityX: 0 },
      ]);
    });

  it('moves to the next tab when swiping left', () => {
    render(<Harness />);

    swipe(-120);
    expect(screen.getByTestId('scene-Sort')).toBeTruthy();
  });

  it('moves to the previous tab when swiping right', () => {
    render(<Harness initialIndex={1} />);

    swipe(120);
    expect(screen.getByTestId('scene-Filter')).toBeTruthy();
  });

  it('stays on the first tab when swiping right from it', () => {
    render(<Harness />);

    swipe(120);
    expect(screen.getByTestId('scene-Filter')).toBeTruthy();
  });

  it('ignores short swipes', () => {
    render(<Harness />);

    swipe(-30);
    expect(screen.getByTestId('scene-Filter')).toBeTruthy();
  });

  it('ignores swipes when swiping is disabled', () => {
    render(<Harness swipeEnabled={false} />);

    swipe(-120);
    expect(screen.getByTestId('scene-Filter')).toBeTruthy();
  });
});
