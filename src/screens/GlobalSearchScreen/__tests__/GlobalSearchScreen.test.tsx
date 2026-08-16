import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@test-utils';
import { getMMKVObject } from '@utils/mmkv/mmkv';
import { getStringAsync } from 'expo-clipboard';
import {
  createNavigationContainerRef,
  useFocusEffect,
} from '@react-navigation/native';
import { showToast } from '@utils/showToast';
import type { PluginItem } from '@plugins/types';
import GlobalSearchScreen from '../GlobalSearchScreen';

jest.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: { value: 0 },
    progress: { value: 0 },
  }),
}));

jest.mock('@react-navigation/native', () => {
  const mockNavigate = jest.fn();
  return {
    createNavigationContainerRef: () => ({
      isReady: jest.fn(() => true),
      navigate: mockNavigate,
      getCurrentRoute: jest.fn(() => null),
    }),
    useFocusEffect: jest.fn(),
    useNavigation: () => ({
      navigate: mockNavigate,
      setOptions: jest.fn(),
      addListener: jest.fn(() => () => {}),
    }),
  };
});

const mockNavigationRef = createNavigationContainerRef();
const mockNavigate = mockNavigationRef.navigate as jest.Mock;

jest.mock('@components/index', () => {
  const { createElement } = require('react');
  const { Text, View, TextInput } = require('react-native');
  return {
    EmptyView: ({ description }: { description: string }) =>
      createElement(Text, null, description),
    SafeAreaView: ({ children }: { children: ReactNode }) =>
      createElement(View, null, children),
    SearchbarV2: ({
      searchText,
      onChangeText,
      onSubmitEditing,
    }: {
      searchText: string;
      onChangeText: (text: string) => void;
      onSubmitEditing: () => void;
    }) =>
      createElement(TextInput, {
        testID: 'search-input',
        value: searchText,
        onChangeText,
        onSubmitEditing,
      }),
    SelectableChip: () => null,
  };
});

jest.mock('react-native-paper', () => {
  const { createElement, Fragment } = require('react');
  const { Pressable, Text } = require('react-native');
  return {
    Provider: ({ children }: { children: ReactNode }) =>
      createElement(Fragment, null, children),
    ProgressBar: () => null,
    FAB: ({
      label,
      onPress,
      testID,
    }: {
      label: string;
      onPress: () => void;
      testID?: string;
    }) =>
      createElement(
        Pressable,
        { testID, onPress },
        createElement(Text, null, label),
      ),
  };
});

jest.mock('expo-clipboard', () => ({
  __esModule: true,
  getStringAsync: jest.fn(async () => ''),
  setStringAsync: jest.fn(async () => {}),
}));

jest.mock('@hooks', () => {
  const { useCallback, useEffect, useMemo, useState } = require('react');
  return {
    useSearch: (defaultSearchText?: string, clearSearchOnUnfocus = true) => {
      const [searchText, setSearchText] = useState(defaultSearchText || '');
      const clearSearchbar = useCallback(() => setSearchText(''), []);
      useEffect(() => {
        if (!clearSearchOnUnfocus) {
          return;
        }
        return require('@react-navigation/native')
          .useNavigation()
          .addListener('blur', clearSearchbar);
      }, [clearSearchbar, clearSearchOnUnfocus]);
      return useMemo(
        () => ({ searchText, setSearchText, clearSearchbar }),
        [searchText, setSearchText, clearSearchbar],
      );
    },
  };
});

jest.mock('@hooks/persisted', () => ({
  useTheme: () => ({}),
}));

jest.mock('@hooks/persisted/useTheme', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({}),
}));

jest.mock('@components/AppErrorBoundary/AppErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('react-native-safe-area-context', () => {
  const ReactModule = require('react');
  const { View } = require('react-native');
  const frame = { height: 800, width: 400, x: 0, y: 0 };
  const insets = { bottom: 0, left: 0, right: 0, top: 0 };

  return {
    SafeAreaFrameContext: ReactModule.createContext(frame),
    SafeAreaInsetsContext: ReactModule.createContext(insets),
    SafeAreaProvider: ({ children }: { children: ReactNode }) => children,
    SafeAreaView: ({ children, ...props }: { children: ReactNode }) =>
      ReactModule.createElement(View, props, children),
    initialWindowMetrics: { frame, insets },
    useSafeAreaFrame: () => frame,
    useSafeAreaInsets: () => insets,
  };
});

jest.mock('@gorhom/bottom-sheet', () => ({
  BottomSheetModalProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

jest.mock('../hooks/useGlobalSearch', () => ({
  useGlobalSearch: () => ({ searchResults: [], progress: 0 }),
}));

jest.mock('../components/GlobalSearchResultsList', () => () => null);

jest.mock('@plugins/pluginManager', () => ({
  INSTALLED_PLUGINS_KEY: 'INSTALL_PLUGINS',
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: jest.fn(),
  setMMKVObject: jest.fn(),
}));

const testSource: PluginItem = {
  id: 'test-source',
  name: 'Test Source',
  site: 'https://testsource.example.com/',
  lang: 'English',
  version: '1.0.0',
  url: 'https://example.com/test-source.js',
  iconUrl: 'https://example.com/test-source.png',
};

const NOVEL_URL =
  'https://testsource.example.com/fiction/21220/mother-of-learning';

const mockGetMMKVObject = getMMKVObject as jest.Mock;
const mockShowToast = showToast as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  mockGetMMKVObject.mockReturnValue([testSource]);
  (getStringAsync as jest.Mock).mockResolvedValue('');
  (useFocusEffect as jest.Mock).mockReset();
});

describe('GlobalSearchScreen', () => {
  it('shows the open-novel button for a matching URL and navigates on press', () => {
    render(<GlobalSearchScreen />);

    fireEvent.changeText(screen.getByTestId('search-input'), NOVEL_URL);

    expect(screen.getByTestId('open-novel-button')).toBeTruthy();
    fireEvent.press(screen.getByText('globalSearch.openNovel'));

    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: 'fiction/21220/mother-of-learning',
        pluginId: 'test-source',
        cover: null,
      },
    });
  });

  it('navigates on keyboard submit for a matching URL', () => {
    render(<GlobalSearchScreen />);

    fireEvent.changeText(screen.getByTestId('search-input'), NOVEL_URL);
    fireEvent(screen.getByTestId('search-input'), 'submitEditing');

    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: 'fiction/21220/mother-of-learning',
        pluginId: 'test-source',
        cover: null,
      },
    });
  });

  it('offers no open-novel button and toasts when the URL matches no installed source', () => {
    mockGetMMKVObject.mockReturnValue([]);
    render(<GlobalSearchScreen />);

    fireEvent.changeText(
      screen.getByTestId('search-input'),
      'https://www.someothersite.com/novel/1',
    );

    // An unmatched URL must not be advertised as an openable novel.
    expect(screen.queryByTestId('open-novel-button')).toBeNull();

    fireEvent(screen.getByTestId('search-input'), 'submitEditing');

    expect(mockShowToast).toHaveBeenCalledWith('globalSearch.noSourceForUrl');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('offers the clipboard novel while the search bar is empty', async () => {
    (useFocusEffect as jest.Mock).mockImplementation(cb => {
      cb();
    });
    (getStringAsync as jest.Mock).mockResolvedValue(NOVEL_URL);

    render(<GlobalSearchScreen />);

    expect(await screen.findByTestId('open-novel-button')).toBeTruthy();
    fireEvent.press(screen.getByText('globalSearch.openCopiedNovel'));

    expect(mockNavigate).toHaveBeenCalledWith('ReaderStack', {
      screen: 'Novel',
      params: {
        name: '',
        path: 'fiction/21220/mother-of-learning',
        pluginId: 'test-source',
        cover: null,
      },
    });
  });

  it('offers nothing when the clipboard holds an unmatched URL', async () => {
    (useFocusEffect as jest.Mock).mockImplementation(cb => {
      cb();
    });
    (getStringAsync as jest.Mock).mockResolvedValue(
      'https://www.someothersite.com/novel/1',
    );

    render(<GlobalSearchScreen />);

    await waitFor(() => expect(getStringAsync).toHaveBeenCalled());

    expect(screen.queryByTestId('open-novel-button')).toBeNull();
  });

  it('shows no button for plain text', () => {
    render(<GlobalSearchScreen />);

    fireEvent.changeText(screen.getByTestId('search-input'), 'abc');

    expect(screen.queryByTestId('open-novel-button')).toBeNull();
  });
});
