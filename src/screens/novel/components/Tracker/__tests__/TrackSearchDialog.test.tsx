import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import TrackSearchDialog from '../TrackSearchDialog';
import type { SearchResult } from '@services/Trackers';
import type { TrackerMetadata } from '@hooks/persisted/useTracker';

const mockHandleSearch = jest.fn();

jest.mock('@hooks/persisted', () => ({
  getTracker: () => ({ handleSearch: mockHandleSearch }),
  useTheme: () => ({
    onSurface: '#111111',
    onSurfaceVariant: '#444444',
    outline: '#777777',
    primary: '#006666',
    rippleColor: '#dddddd',
    surface: '#ffffff',
    surfaceVariant: '#eeeeee',
  }),
}));

jest.mock('@components', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const Section = ({ children }: { children: React.ReactNode }) =>
    ReactModule.createElement(View, null, children);

  return {
    Dialog: {
      Action: ({ onPress, title }: { onPress: () => void; title: string }) =>
        ReactModule.createElement(Text, { onPress }, title),
      Actions: Section,
      Content: Section,
      Root: Section,
      ScrollArea: Section,
      Title: Section,
    },
    NovelCoverImage: () => null,
  };
});

jest.mock('react-native-paper', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Pressable, TextInput: NativeTextInput } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const TextInput = (props: Record<string, unknown>) =>
    ReactModule.createElement(NativeTextInput, {
      ...props,
      testID: 'tracker-search-input',
    });
  TextInput.Icon = () => null;

  return {
    TextInput,
    TouchableRipple: ({
      children,
      onPress,
    }: {
      children: React.ReactNode;
      onPress: () => void;
    }) => ReactModule.createElement(Pressable, { onPress }, children),
  };
});

jest.mock('@shopify/flash-list', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { View } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    FlashList: ({
      data,
      ListEmptyComponent,
      renderItem,
    }: {
      data: SearchResult[];
      ListEmptyComponent?: React.ReactNode;
      renderItem: ({ item }: { item: SearchResult }) => React.ReactElement;
    }) =>
      ReactModule.createElement(
        View,
        null,
        data.length
          ? data.map(item =>
              ReactModule.createElement(
                ReactModule.Fragment,
                { key: item.id },
                renderItem({ item }),
              ),
            )
          : ListEmptyComponent,
      ),
  };
});

jest.mock('@react-native-vector-icons/material-design-icons', () => 'Icon');

const tracker = {
  auth: { accessToken: 'token' },
  name: 'AniList',
} as TrackerMetadata;

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(promiseResolve => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
};

describe('TrackSearchDialog', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockHandleSearch.mockReset();
    mockHandleSearch.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('debounces search text changes and searches only the latest value', async () => {
    render(
      <TrackSearchDialog
        novelName="Initial title"
        onDismiss={jest.fn()}
        onTrackNovel={jest.fn()}
        tracker={tracker}
        visible
      />,
    );

    fireEvent.changeText(
      screen.getByTestId('tracker-search-input'),
      'First value',
    );
    act(() => jest.advanceTimersByTime(200));
    fireEvent.changeText(
      screen.getByTestId('tracker-search-input'),
      'Latest value',
    );
    act(() => jest.advanceTimersByTime(349));

    expect(mockHandleSearch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(mockHandleSearch).toHaveBeenCalledTimes(1);
    expect(mockHandleSearch).toHaveBeenCalledWith('Latest value', tracker.auth);
  });

  it('ignores a stale response that finishes after a newer search', async () => {
    const firstSearch = deferred<SearchResult[]>();
    const secondSearch = deferred<SearchResult[]>();
    mockHandleSearch
      .mockReturnValueOnce(firstSearch.promise)
      .mockReturnValueOnce(secondSearch.promise);

    render(
      <TrackSearchDialog
        novelName="Initial title"
        onDismiss={jest.fn()}
        onTrackNovel={jest.fn()}
        tracker={tracker}
        visible
      />,
    );

    act(() => jest.advanceTimersByTime(350));
    fireEvent.changeText(
      screen.getByTestId('tracker-search-input'),
      'New title',
    );
    act(() => jest.advanceTimersByTime(350));

    await act(async () => {
      secondSearch.resolve([{ coverImage: '', id: 2, title: 'Newer result' }]);
      await Promise.resolve();
    });

    expect(screen.getByText('Newer result')).toBeTruthy();

    await act(async () => {
      firstSearch.resolve([{ coverImage: '', id: 1, title: 'Stale result' }]);
      await Promise.resolve();
    });

    expect(screen.queryByText('Stale result')).toBeNull();
    expect(screen.getByText('Newer result')).toBeTruthy();
  });
});
