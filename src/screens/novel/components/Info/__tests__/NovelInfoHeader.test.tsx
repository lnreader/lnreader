import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import type { ThemeColors } from '@theme/types';
import type { NovelInfo } from '@database/types';
import NovelInfoHeader from '../NovelInfoHeader';

const mockFollowNovel = jest.fn();
const mockGetDownloadedChapterIds = jest.fn();

jest.mock('@screens/novel/NovelContext', () => ({
  useNovelAction: () => mockFollowNovel,
}));

jest.mock('@database/queries/ChapterQueries', () => ({
  getDownloadedChapterIds: (...args: unknown[]) =>
    mockGetDownloadedChapterIds(...args),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ replace: jest.fn() }),
}));

jest.mock('@hooks/persisted', () => ({
  useAppSettings: () => ({ hideBackdrop: false }),
}));

jest.mock('@hooks/persisted/usePlugins', () => ({
  AVAILABLE_PLUGINS: 'AVAILABLE_PLUGINS',
}));

jest.mock('@plugins/pluginManager', () => ({
  getPlugin: () => undefined,
}));

jest.mock('@utils/mmkv/mmkv', () => ({
  getMMKVObject: () => [],
}));

jest.mock('@i18n/translations', () => ({
  getString: (key: string) => key,
}));

jest.mock('../NovelInfoComponents', () => {
  const React = require('react');
  const { View } = require('react-native');
  const container = ({ children }: { children?: unknown }) =>
    React.createElement(View, null, children);
  return {
    CoverImage: container,
    NovelInfo: container,
    NovelInfoContainer: container,
    NovelThumbnail: () => null,
    NovelTitle: () => null,
    NovelGenres: () => null,
  };
});

jest.mock('../ReadButton', () => () => null);
jest.mock('../../NovelSummary/NovelSummary', () => () => null);

jest.mock('../../NovelScreenButtonGroup/NovelScreenButtonGroup', () => {
  const React = require('react');
  const { Pressable, Text } = require('react-native');
  return ({ handleFollowNovel }: { handleFollowNovel: () => void }) =>
    React.createElement(
      Pressable,
      { testID: 'follow-novel', onPress: handleFollowNovel },
      React.createElement(Text, null, 'follow'),
    );
});

jest.mock('@components/Skeleton/Skeleton', () => ({
  NovelMetaSkeleton: () => null,
  VerticalBarSkeleton: () => null,
}));

const theme = {} as ThemeColors;

const novel: NovelInfo = {
  id: 7,
  path: '/novels/test',
  pluginId: 'local',
  name: 'Test Novel',
  inLibrary: true,
};

const renderHeader = (overrides: Partial<NovelInfo> = {}) => {
  const deleteDownloadSnackbar = {
    value: false,
    setTrue: jest.fn(),
    setFalse: jest.fn(),
    toggle: jest.fn(),
    setValue: jest.fn(),
  };
  render(
    <NovelInfoHeader
      deleteDownloadSnackbar={deleteDownloadSnackbar}
      fetching={false}
      isLoading={false}
      navigateToChapter={jest.fn()}
      novel={{ ...novel, ...overrides }}
      novelBottomSheetRef={{ current: null }}
      setCustomNovelCover={jest.fn()}
      saveNovelCover={jest.fn()}
      theme={theme}
      trackerSheetRef={{ current: null }}
    />,
  );
  return { snackbar: deleteDownloadSnackbar };
};

describe('NovelInfoHeader remove-from-library prompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFollowNovel.mockResolvedValue(undefined);
  });

  it('offers to delete downloads that exist beyond the loaded chapters', async () => {
    mockGetDownloadedChapterIds.mockResolvedValue([1001, 1002]);
    const { snackbar } = renderHeader();

    fireEvent.press(screen.getByTestId('follow-novel'));

    await waitFor(() => expect(snackbar.setTrue).toHaveBeenCalled());
    expect(mockGetDownloadedChapterIds).toHaveBeenCalledWith(7);
  });

  it('does not prompt when the novel has no downloads left', async () => {
    mockGetDownloadedChapterIds.mockResolvedValue([]);
    const { snackbar } = renderHeader();

    fireEvent.press(screen.getByTestId('follow-novel'));

    await waitFor(() => expect(snackbar.setFalse).toHaveBeenCalled());
    expect(snackbar.setTrue).not.toHaveBeenCalled();
  });

  it('does not prompt when adding the novel to the library', async () => {
    const { snackbar } = renderHeader({ inLibrary: false });

    fireEvent.press(screen.getByTestId('follow-novel'));

    await waitFor(() => expect(snackbar.setFalse).toHaveBeenCalled());
    expect(mockGetDownloadedChapterIds).not.toHaveBeenCalled();
  });
});
