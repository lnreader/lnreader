import type { ReactNode } from 'react';
import type { BrowseSourceScreenProps } from '@navigators/types';
import type { NovelItem, Plugin } from '@plugins/types';
import { getPlugin } from '@plugins/pluginManager';
import { Filters, FilterTypes } from '@plugins/types/filterTypes';
import { act, fireEvent, render, screen } from '@test-utils';
import BrowseSourceScreen from '../BrowseSourceScreen';

jest.mock('@components/index', () => ({
  ErrorScreenV2: require('@components/ErrorScreenV2/ErrorScreenV2').default,
  SafeAreaView: require('@components/SafeAreaView/SafeAreaView').default,
  SearchbarV2: require('@components/SearchbarV2/SearchbarV2').default,
}));

jest.mock('@components/Context/LibraryContext', () => ({
  useLibraryContext: () => ({ novelInLibrary: jest.fn() }),
}));

jest.mock('@hooks', () => ({
  useSearch: require('@hooks/common/useSearch').default,
}));

jest.mock('@hooks/persisted', () => ({
  useTheme: require('@hooks/persisted/useTheme').useTheme,
}));

jest.mock('@screens/novel/NovelContext', () => ({
  NovelContextProvider: ({ children }: { children: ReactNode }) => children,
}));

jest.mock(
  'react-native-safe-area-context',
  () => jest.requireActual('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@components/NovelList', () => {
  const { ScrollView, View } = require('react-native');

  return ({
    data,
    renderItem,
    ListFooterComponent,
    onScroll,
  }: {
    data: NovelItem[];
    renderItem: (info: { item: NovelItem }) => ReactNode;
    ListFooterComponent: ReactNode;
    onScroll: () => void;
  }) => (
    <ScrollView testID="novel-list" onScroll={onScroll}>
      {data.map(item => (
        <View key={item.path}>{renderItem({ item })}</View>
      ))}
      {ListFooterComponent}
    </ScrollView>
  );
});

jest.mock('@components/NovelCover', () => {
  const { Text } = require('react-native');
  return ({ item }: { item: NovelItem }) => <Text>{item.name}</Text>;
});

jest.mock('../components/FilterBottomSheet', () => {
  const { Pressable, Text } = require('react-native');
  return ({ setFilters }: { setFilters: (filters: Filters) => void }) => (
    <Pressable onPress={() => setFilters(mockSelectedFilters)}>
      <Text>Apply test filter</Text>
    </Pressable>
  );
});

jest.mock(
  '@screens/browse/loadingAnimation/SourceScreenSkeletonLoading',
  () => {
    const { View } = require('react-native');
    return () => <View testID="source-loading" />;
  },
);

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: jest.fn(),
}));

const popularNovels = jest.fn<
  ReturnType<Plugin['popularNovels']>,
  Parameters<Plugin['popularNovels']>
>();
const searchNovels = jest.fn<
  ReturnType<Plugin['searchNovels']>,
  Parameters<Plugin['searchNovels']>
>();
const novel = (name: string): NovelItem => ({
  id: undefined,
  name,
  path: name,
});
const mockSelectedFilters: Filters = {
  genre: { label: 'Genre', type: FilterTypes.TextInput, value: 'Fantasy' },
};

const renderSource = () =>
  render(
    <BrowseSourceScreen
      route={{
        key: 'source-test',
        name: 'SourceScreen',
        params: {
          pluginId: 'test',
          pluginName: 'Test Source',
          site: 'https://example.com',
        },
      }}
      navigation={
        {
          goBack: jest.fn(),
        } as unknown as BrowseSourceScreenProps['navigation']
      }
    />,
  );

const searchInput = () => screen.getByPlaceholderText('Search Test Source');

const submitSearch = (query: string) => {
  fireEvent.changeText(searchInput(), query);
  fireEvent(searchInput(), 'submitEditing');
};

const scrollNearEnd = (y: number) => {
  fireEvent.scroll(screen.getByTestId('novel-list'), {
    nativeEvent: {
      contentOffset: { y },
      contentSize: { height: 600 },
      layoutMeasurement: { height: 400 },
    },
  });
};

const reachShortListEnd = () => {
  fireEvent(screen.getByTestId('novel-list'), 'endReached', {
    distanceFromEnd: -100,
  });
};

const deferredPage = () => {
  let resolve!: (items: NovelItem[]) => void;
  const promise = new Promise<NovelItem[]>(done => {
    resolve = done;
  });
  return { promise, resolve };
};

beforeEach(() => {
  popularNovels.mockReset().mockResolvedValue([novel('Popular novel')]);
  searchNovels.mockReset();
  jest.mocked(getPlugin).mockReturnValue({
    id: 'test',
    name: 'Test Source',
    site: 'https://example.com',
    lang: 'English',
    version: '1.0.0',
    url: 'https://example.com/plugin.js',
    iconUrl: 'https://example.com/icon.png',
    imageRequestInit: { headers: {} },
    filters: {
      genre: { label: 'Genre', type: FilterTypes.TextInput, value: '' },
    },
    popularNovels,
    searchNovels,
    parseChapter: jest.fn(),
    parseNovel: jest.fn(),
  });
});

it('shows empty submitted searches and restores popular novels when cleared', async () => {
  searchNovels.mockResolvedValue([]);
  renderSource();
  expect(await screen.findByText('Popular novel')).toBeOnTheScreen();

  fireEvent.changeText(searchInput(), 'missing');
  expect(screen.getByText('Popular novel')).toBeOnTheScreen();
  expect(searchNovels).not.toHaveBeenCalled();
  fireEvent(searchInput(), 'submitEditing');

  expect(await screen.findByText('No results found')).toBeOnTheScreen();
  expect(screen.queryByText('Popular novel')).toBeNull();
  expect(screen.queryByTestId('source-loading')).toBeNull();

  fireEvent.press(screen.getByLabelText('Clear'));
  expect(screen.getByText('Popular novel')).toBeOnTheScreen();
  expect(popularNovels).toHaveBeenCalledTimes(1);
});

it('retries the submitted query after a network failure even if the draft changes', async () => {
  const retry = deferredPage();
  popularNovels.mockRejectedValueOnce(new Error('Popular feed unavailable'));
  searchNovels
    .mockRejectedValueOnce(new Error('Network request failed'))
    .mockReturnValueOnce(retry.promise);
  renderSource();
  expect(await screen.findByText('Popular feed unavailable')).toBeOnTheScreen();

  submitSearch('original query');
  expect(await screen.findByText('Network request failed')).toBeOnTheScreen();
  expect(screen.queryByTestId('source-loading')).toBeNull();

  fireEvent.changeText(searchInput(), 'different draft');
  fireEvent.press(screen.getByText('Retry'));
  expect(screen.getByTestId('source-loading')).toBeOnTheScreen();
  expect(searchNovels.mock.calls).toEqual([
    ['original query', 1],
    ['original query', 1],
  ]);

  await act(async () => retry.resolve([novel('Recovered result')]));
  expect(screen.getByText('Recovered result')).toBeOnTheScreen();
  expect(screen.queryByText('Popular feed unavailable')).toBeNull();
  expect(screen.queryByTestId('source-loading')).toBeNull();
});

it('stops filling a short search list after a page failure and appends the retry once', async () => {
  const retry = deferredPage();
  searchNovels
    .mockResolvedValueOnce([novel('Page one')])
    .mockRejectedValueOnce(new Error('Page unavailable'))
    .mockReturnValueOnce(retry.promise);
  renderSource();

  submitSearch('original query');
  expect(await screen.findByText('Page one')).toBeOnTheScreen();
  fireEvent.changeText(searchInput(), 'different draft');
  reachShortListEnd();
  reachShortListEnd();

  expect(await screen.findByText('Page unavailable')).toBeOnTheScreen();
  expect(screen.getByText('Page one')).toBeOnTheScreen();
  expect(screen.queryByTestId('source-loading')).toBeNull();
  reachShortListEnd();
  scrollNearEnd(120);
  expect(searchNovels).toHaveBeenCalledTimes(2);

  fireEvent.press(screen.getByText('Retry'));
  expect(screen.getByText('Page one')).toBeOnTheScreen();
  expect(screen.getByTestId('source-loading')).toBeOnTheScreen();

  await act(async () => retry.resolve([novel('Page two')]));
  expect(screen.getByText('Page one')).toBeOnTheScreen();
  expect(screen.getAllByText('Page two')).toHaveLength(1);
  expect(screen.queryByText('Page unavailable')).toBeNull();
  expect(screen.queryByTestId('source-loading')).toBeNull();
  expect(searchNovels.mock.calls).toEqual([
    ['original query', 1],
    ['original query', 2],
    ['original query', 2],
  ]);
});

it('keeps filling a short list until the source returns an empty page', async () => {
  searchNovels
    .mockResolvedValueOnce([novel('First result')])
    .mockResolvedValueOnce([novel('Second result')])
    .mockResolvedValueOnce([]);
  renderSource();

  submitSearch('short');
  expect(await screen.findByText('First result')).toBeOnTheScreen();
  reachShortListEnd();
  expect(await screen.findByText('Second result')).toBeOnTheScreen();
  await act(async () => reachShortListEnd());

  reachShortListEnd();
  expect(searchNovels.mock.calls).toEqual([
    ['short', 1],
    ['short', 2],
    ['short', 3],
  ]);
  expect(screen.getByText('First result')).toBeOnTheScreen();
  expect(screen.getByText('Second result')).toBeOnTheScreen();
  expect(screen.queryByTestId('source-loading')).toBeNull();
});

it('ignores late responses after a new query and after clearing search', async () => {
  const oldQuery = deferredPage();
  const currentQuery = deferredPage();
  const clearedQuery = deferredPage();
  searchNovels
    .mockReturnValueOnce(oldQuery.promise)
    .mockReturnValueOnce(currentQuery.promise)
    .mockReturnValueOnce(clearedQuery.promise);
  renderSource();

  submitSearch('old');
  submitSearch('current');
  await act(async () => currentQuery.resolve([novel('Current result')]));
  await act(async () => oldQuery.resolve([novel('Old result')]));
  expect(screen.getByText('Current result')).toBeOnTheScreen();
  expect(screen.queryByText('Old result')).toBeNull();

  submitSearch('cleared');
  fireEvent.changeText(searchInput(), '');
  await act(async () => clearedQuery.resolve([novel('Cleared result')]));
  expect(screen.getByText('Popular novel')).toBeOnTheScreen();
  expect(screen.queryByText('Cleared result')).toBeNull();
});

it('continues paging the filtered popular feed while a query is only a draft', async () => {
  popularNovels
    .mockResolvedValueOnce([novel('Popular novel')])
    .mockResolvedValueOnce([novel('Filtered novel')])
    .mockResolvedValueOnce([novel('Another filtered novel')]);
  renderSource();
  expect(await screen.findByText('Popular novel')).toBeOnTheScreen();

  fireEvent.press(screen.getByText('Apply test filter'));
  expect(await screen.findByText('Filtered novel')).toBeOnTheScreen();

  fireEvent.changeText(searchInput(), 'draft');
  scrollNearEnd(100);

  expect(await screen.findByText('Another filtered novel')).toBeOnTheScreen();
  expect(popularNovels).toHaveBeenLastCalledWith(2, {
    filters: mockSelectedFilters,
    showLatestNovels: undefined,
  });
  expect(searchNovels).not.toHaveBeenCalled();
});
