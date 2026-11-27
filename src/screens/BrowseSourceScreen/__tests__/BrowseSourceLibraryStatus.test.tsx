import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { act, fireEvent, render, screen } from '@test-utils';
import { useLibraryContext } from '@components/Context/LibraryContext';
import { getString } from '@i18n/translations';
import type { BrowseSourceScreenProps } from '@navigators/types';
import BrowseSourceScreen from '../BrowseSourceScreen';

jest.mock('@components/index', () => ({
  ErrorScreenV2: require('@components/ErrorScreenV2/ErrorScreenV2').default,
  SafeAreaView: require('@components/SafeAreaView/SafeAreaView').default,
  SearchbarV2: require('@components/SearchbarV2/SearchbarV2').default,
}));
jest.mock('@components/Context/LibraryContext', () => ({
  useLibraryContext: jest.fn(),
}));
jest.mock('@components/NovelCoverImage', () => () => null);
jest.mock('@hooks', () => ({
  useSearch: require('@hooks/common/useSearch').default,
  useDeviceOrientation: () => 'portrait',
}));
jest.mock('@hooks/persisted', () => ({
  useTheme: require('@hooks/persisted/useTheme').useTheme,
  useLibrarySettings: () => ({ novelsPerRow: 3 }),
}));
jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);
jest.mock('../components/FilterBottomSheet', () => () => null);
jest.mock('@plugins/pluginManager', () => ({ getPlugin: () => undefined }));
jest.mock('../useBrowseSource', () => {
  const page = {
    novels: [{ name: 'Example novel', path: '/example' }],
    isLoading: false,
    nextPage: null,
  };
  return {
    useBrowseSource: () => ({ page }),
    useSearchSource: () => ({}),
  };
});

const sourceProps = {
  route: {
    key: 'source-test',
    name: 'SourceScreen',
    params: {
      pluginId: 'test',
      pluginName: 'Test Source',
      site: 'https://example.com',
    },
  },
  navigation: { goBack: jest.fn() },
} as unknown as BrowseSourceScreenProps;

const mockLibraryContext = (
  inLibrary: boolean,
  switchNovelToLibrary = jest.fn(),
) => {
  const context: Partial<ReturnType<typeof useLibraryContext>> = {
    novelInLibrary: (pluginId, path) =>
      inLibrary && pluginId === 'test' && path === '/example',
    switchNovelToLibrary,
  };
  jest
    .mocked(useLibraryContext)
    .mockReturnValue(context as ReturnType<typeof useLibraryContext>);
};

const layoutList = () => {
  fireEvent(screen.UNSAFE_getByType(ScrollView), 'layout', {
    nativeEvent: { layout: { width: 400, height: 800, x: 0, y: 0 } },
  });
};

it('shows progress and refreshes the library badge after long-press additions and removals', async () => {
  let finishSwitch!: (completed: boolean) => void;
  const switchNovelToLibrary = jest.fn(
    () =>
      new Promise<boolean>(resolve => {
        finishSwitch = resolve;
      }),
  );
  mockLibraryContext(false, switchNovelToLibrary);
  render(<BrowseSourceScreen {...sourceProps} />);
  layoutList();

  const badge = getString('novelScreen.inLibaray');
  expect(await screen.findByText('Example novel')).toBeOnTheScreen();
  expect(screen.queryByText(badge)).toBeNull();

  fireEvent(screen.getByText('Example novel'), 'longPress');
  expect(switchNovelToLibrary).toHaveBeenCalledWith('/example', 'test');
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();

  mockLibraryContext(true, switchNovelToLibrary);
  await act(async () => finishSwitch(true));
  expect(screen.getByText(badge)).toBeOnTheScreen();
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();

  fireEvent(screen.getByText('Example novel'), 'longPress');
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).not.toBeNull();
  mockLibraryContext(false, switchNovelToLibrary);
  await act(async () => finishSwitch(true));
  expect(screen.queryByText(badge)).toBeNull();
  expect(screen.UNSAFE_queryByType(ActivityIndicator)).toBeNull();
});

it('refreshes membership changed elsewhere without replacing the source results', async () => {
  mockLibraryContext(false);
  const view = render(<BrowseSourceScreen {...sourceProps} />);
  layoutList();
  expect(await screen.findByText('Example novel')).toBeOnTheScreen();

  mockLibraryContext(true);
  view.rerender(<BrowseSourceScreen {...sourceProps} />);
  expect(
    screen.getByText(getString('novelScreen.inLibaray')),
  ).toBeOnTheScreen();

  mockLibraryContext(false);
  view.rerender(<BrowseSourceScreen {...sourceProps} />);
  expect(screen.queryByText(getString('novelScreen.inLibaray'))).toBeNull();
});
