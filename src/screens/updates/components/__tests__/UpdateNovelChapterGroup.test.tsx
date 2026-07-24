import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';

import { UpdateOverview } from '@database/types';
import UpdateNovelChapterGroup from '../UpdateNovelChapterGroup';

const mockFetchDetailedUpdates = jest.fn();
const mockNovelChapterGroup = jest.fn();

jest.mock('@hooks/persisted/useUpdates', () => ({
  fetchDetailedUpdates: (...args: unknown[]) =>
    mockFetchDetailedUpdates(...args),
}));

jest.mock('@screens/novel/components/NovelChapterGroup', () => {
  const ReactModule = jest.requireActual<typeof import('react')>('react');
  const { Pressable } =
    jest.requireActual<typeof import('react-native')>('react-native');

  return {
    __esModule: true,
    default: (props: { onExpand?: () => void }) => {
      mockNovelChapterGroup(props);
      return ReactModule.createElement(Pressable, {
        onPress: props.onExpand,
        testID: 'novel-chapter-group',
      });
    },
  };
});

jest.mock('@utils/showToast', () => ({
  showToast: jest.fn(),
}));

const overview: UpdateOverview = {
  novelId: 42,
  pluginId: 'source-id',
  novelName: 'Example Novel',
  novelPath: '/example-novel',
  novelCover: null,
  updateDate: '2026-07-24',
  updatesPerDay: 2,
};

describe('UpdateNovelChapterGroup', () => {
  beforeEach(() => {
    mockFetchDetailedUpdates.mockReset();
    mockNovelChapterGroup.mockReset();
    mockFetchDetailedUpdates.mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('loads a collapsed group only on its first expansion', async () => {
    render(
      <UpdateNovelChapterGroup
        chapterCountLabel="updates"
        onDeleteChapter={jest.fn()}
        overview={overview}
      />,
    );

    expect(mockFetchDetailedUpdates).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('novel-chapter-group'));

    await waitFor(() =>
      expect(mockFetchDetailedUpdates).toHaveBeenCalledWith(
        overview.novelId,
        false,
        overview.updateDate,
      ),
    );

    fireEvent.press(screen.getByTestId('novel-chapter-group'));

    expect(mockFetchDetailedUpdates).toHaveBeenCalledTimes(1);
  });

  it('loads a single-chapter group immediately because it has no accordion', async () => {
    jest.useFakeTimers();

    render(
      <UpdateNovelChapterGroup
        chapterCountLabel="update"
        onDeleteChapter={jest.fn()}
        overview={{ ...overview, updatesPerDay: 1 }}
      />,
    );

    expect(mockFetchDetailedUpdates).not.toHaveBeenCalled();

    await act(async () => {
      jest.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(mockFetchDetailedUpdates).toHaveBeenCalledTimes(1);
  });
});
